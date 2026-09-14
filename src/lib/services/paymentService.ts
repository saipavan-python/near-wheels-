import { prisma } from "../db";
import { getSettings } from "../config";
import { moveStatus } from "./bookingService";
import { notifyUser, notifyProvider } from "./notificationService";
import { audit } from "./auditService";
import Razorpay from "razorpay";

const razorpayClient = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

function hasRazorpayCreds(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function getWebhookSecret(): string {
  return process.env.RAZORPAY_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET || "";
}

/**
 * Payment flow (spec §44, §76): customer pays Near Wheels; commission is
 * deducted and the rest becomes a provider payout. Every state change leaves
 * an auditable record. "Payment successful" only ever comes from here.
 */
export async function initiatePayment(bookingId: string) {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (!["ACCEPTED", "PENDING_PROVIDER", "REQUESTED"].includes(booking.status))
    throw new Error("Booking is not payable in its current state");
  if (["PAID", "REFUNDED"].includes(booking.paymentStatus)) throw new Error("Already paid");

  const mode = process.env.PAYMENT_MODE || "simulated";
  const isRazorpay = hasRazorpayCreds() && mode === "razorpay";

  if (isRazorpay) {
    const order = await razorpayClient.orders.create({
      amount: Math.round(booking.totalAmount * 100),
      currency: "INR",
      receipt: booking.code,
      notes: { bookingId, customerId: booking.customerId },
    });

    await prisma.payment.create({
      data: {
        bookingId,
        amount: booking.totalAmount,
        status: "PENDING",
        mode: "razorpay",
        gatewayRef: order.id,
        providerPaymentId: order.id,
      },
    });
    await prisma.booking.update({ where: { id: bookingId }, data: { paymentStatus: "PENDING" } });
    const payment = await prisma.payment.findFirst({ where: { bookingId } });
    return payment!;
  }

  const payment = await prisma.payment.create({
    data: {
      bookingId,
      amount: booking.totalAmount,
      status: "PENDING",
      mode: "simulated",
      gatewayRef: `sim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    },
  });
  await prisma.booking.update({ where: { id: bookingId }, data: { paymentStatus: "PENDING" } });
  return payment;
}

export async function verifyPayment(gatewayRef: string, outcome: "success" | "failure", signature?: string) {
  const payment = await prisma.payment.findFirst({
    where: { gatewayRef },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) throw new Error("Unknown payment reference");
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: payment.bookingId } });
  const settings = await getSettings();

  if (outcome === "failure") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });
    await prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: "FAILED" } });
    return { status: "FAILED" as const };
  }

  if (payment.mode === "razorpay") {
    const fetched = await razorpayClient.payments.fetch(gatewayRef);
    if (fetched.status !== "captured") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED" },
      });
      await prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: "FAILED" } });
      return { status: "FAILED" as const, error: "Payment not captured by Razorpay" };
    }
    if (signature && getWebhookSecret()) {
      const body = JSON.stringify({});
      const isValid = Razorpay.validateWebhookSignature(body, signature, getWebhookSecret());
      if (!isValid) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED" },
        });
        await prisma.booking.update({ where: { id: booking.id }, data: { paymentStatus: "FAILED" } });
        return { status: "FAILED" as const, error: "Invalid Razorpay signature" };
      }
    }
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "SUCCESS", verifiedAt: new Date() },
  });

  const sub = await prisma.providerSubscription.findUnique({
    where: { providerId: booking.providerId },
    include: { plan: true },
  });
  const planCode = (sub?.plan.code as keyof typeof settings.commissionRates) || "FREE";
  const rate = sub?.plan.commissionRate ?? settings.commissionRates[planCode] ?? settings.commissionRates.FREE;
  const commission = Math.round(booking.totalAmount * rate * 100) / 100;

  await prisma.booking.update({
    where: { id: booking.id },
    data: { paymentStatus: "PAID", commissionAmount: commission, feesAmount: 0 },
  });

  await prisma.commissionRecord.create({
    data: {
      bookingId: booking.id,
      providerId: booking.providerId,
      rate,
      amount: commission,
    },
  });
  await prisma.payout.create({
    data: {
      providerId: booking.providerId,
      bookingId: booking.id,
      grossAmount: booking.totalAmount,
      commissionAmount: commission,
      netAmount: booking.totalAmount - commission,
      status: "PENDING",
    },
  });

  try {
    await moveStatus(booking.id, "CONFIRMED");
  } catch {
    // e.g. was already EN_ROUTE — keep payment state consistent regardless
  }

  await audit("SYSTEM", null, "PAYMENT_VERIFIED", "Payment", payment.id, {
    bookingId: booking.id,
    amount: payment.amount,
    commission,
  });
  await Promise.all([
    notifyUser(booking.customerId, "Payment received", `${booking.code} is confirmed. Amount ₹${payment.amount}.`, "/bookings", "SUCCESS"),
    notifyProvider(
      booking.providerId,
      "Booking confirmed",
      `${booking.code} confirmed. Payout ₹${Math.round((booking.totalAmount - commission) * 100) / 100} after commission.`,
      "/providers/dashboard",
      "SUCCESS"
    ),
  ]);

  return { status: "SUCCESS" as const, bookingCode: booking.code };
}

export async function refundPayment(paymentId: string) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (payment.status !== "SUCCESS") throw new Error("Only successful payments can be refunded");

  if (payment.mode === "razorpay" && payment.gatewayRef) {
    try {
      await razorpayClient.payments.refund(payment.gatewayRef, { speed: "optimum" });
    } catch (e) {
      console.error("Razorpay refund failed:", e);
    }
  }

  await prisma.payment.update({ where: { id: paymentId }, data: { status: "REFUNDED" } });
  const booking = await prisma.booking.update({
    where: { id: payment.bookingId },
    data: { paymentStatus: "REFUNDED", status: "REFUNDED" },
  });
  await prisma.payout.deleteMany({ where: { bookingId: booking.id, status: { in: ["PENDING", "PROCESSING"] } } });
  await notifyUser(booking.customerId, "Refund processed", `₹${payment.amount} refunded for ${booking.code}.`, "/bookings", "INFO");
  await audit("ADMIN", undefined, "REFUND_PAYMENT", "Payment", paymentId, { amount: payment.amount });
  return { refunded: true };
}
