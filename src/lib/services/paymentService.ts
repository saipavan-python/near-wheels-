import { prisma } from "../db";
import { getSettings } from "../config";
import { moveStatus } from "./bookingService";
import { notifyUser, notifyProvider } from "./notificationService";
import { audit } from "./auditService";
import { paymentSettled, expectedAmountPaise, roundMoney } from "./paymentGuard";
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

async function failPayment(paymentId: string, bookingId: string, detail: Record<string, unknown>) {
  await prisma.payment.update({ where: { id: paymentId }, data: { status: "FAILED" } });
  await prisma.booking.update({ where: { id: bookingId }, data: { paymentStatus: "FAILED" } });
  await audit("SYSTEM", null, "PAYMENT_FAILED", "Payment", paymentId, detail).catch(() => undefined);
}

/**
 * Resolve a Razorpay order id to its captured payment entity.
 * `gatewayRef` stores the ORDER id; Razorpay's payment APIs need the PAYMENT id.
 */
async function fetchCapturedPayment(orderId: string | null): Promise<{ id: string | null; amount: number } | null> {
  if (!orderId) return null;
  try {
    const resp: any = await razorpayClient.orders.fetchPayments(orderId);
    const items: any[] = resp?.items || [];
    const captured = items.find((p) => p?.status === "captured");
    return captured ? { id: captured.id ?? null, amount: captured.amount ?? 0 } : null;
  } catch {
    throw new Error("Payment status could not be verified with the gateway. Please try again.");
  }
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
      amount: expectedAmountPaise(booking.totalAmount),
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

export async function verifyPayment(gatewayRef: string, outcome: "success" | "failure") {
  const payment = await prisma.payment.findFirst({
    where: { gatewayRef },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) throw new Error("Unknown payment reference");
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: payment.bookingId } });
  const settings = await getSettings();

  if (outcome === "failure") {
    if (paymentSettled(payment.status, booking.paymentStatus)) {
      return { status: "FAILED" as const, idempotentReplay: true };
    }
    await failPayment(payment.id, booking.id, { gatewayRef, reason: "payment reported as failed" });
    return { status: "FAILED" as const };
  }

  // Idempotency guard: webhook replays / double-taps must never double-credit.
  if (paymentSettled(payment.status, booking.paymentStatus)) {
    return { status: "SUCCESS" as const, bookingCode: booking.code, idempotentReplay: true };
  }

  let gatewayPaymentId: string | null = null;

  if (payment.mode === "razorpay") {
    const captured = await fetchCapturedPayment(payment.gatewayRef);
    if (!captured) {
      await failPayment(payment.id, booking.id, { gatewayRef, reason: "not captured by gateway" });
      return { status: "FAILED" as const, error: "Payment not captured by Razorpay" };
    }
    // Amount verification: the captured amount must match the backend-computed total.
    const expected = expectedAmountPaise(booking.totalAmount);
    if (captured.amount !== expected) {
      await failPayment(payment.id, booking.id, { gatewayRef, expected, actual: captured.amount, reason: "amount mismatch" });
      return { status: "FAILED" as const, error: "Payment amount does not match the booking total." };
    }
    gatewayPaymentId = captured.id ?? null;
  }

  const settled = await prisma
    .$transaction(
      async (tx) => {
        const freshPayment = await tx.payment.findUnique({ where: { id: payment.id } });
        const freshBooking = await tx.booking.findUniqueOrThrow({ where: { id: booking.id } });
        if (freshPayment && paymentSettled(freshPayment.status, freshBooking.paymentStatus)) {
          return { replay: true, commission: 0, netAmount: 0 };
        }

        const sub = await tx.providerSubscription.findUnique({
          where: { providerId: freshBooking.providerId },
          include: { plan: true },
        });
        const planCode = (sub?.plan.code as keyof typeof settings.commissionRates) || "FREE";
        const rate = sub?.plan.commissionRate ?? settings.commissionRates[planCode] ?? settings.commissionRates.FREE;
        const commission = roundMoney(freshBooking.totalAmount * rate);
        const netAmount = roundMoney(freshBooking.totalAmount - commission);

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "SUCCESS",
            verifiedAt: new Date(),
            ...(gatewayPaymentId ? { providerPaymentId: gatewayPaymentId } : {}),
          },
        });
        await tx.booking.update({
          where: { id: freshBooking.id },
          data: { paymentStatus: "PAID", commissionAmount: commission, feesAmount: 0 },
        });
        await tx.commissionRecord.create({
          data: { bookingId: freshBooking.id, providerId: freshBooking.providerId, rate, amount: commission },
        });
        await tx.payout.create({
          data: {
            providerId: freshBooking.providerId,
            bookingId: freshBooking.id,
            grossAmount: freshBooking.totalAmount,
            commissionAmount: commission,
            netAmount,
            status: "PENDING",
          },
        });
        return { replay: false, commission, netAmount };
      },
      { isolationLevel: "Serializable", maxWait: 5000, timeout: 20000 }
    )
    .catch(async (e: any) => {
      // Unique payout.bookingId means a concurrent verify already settled it.
      if (e?.code === "P2002" || e?.code === "P2034") {
        const check = await prisma.payment.findUnique({ where: { id: payment.id } });
        if (check && check.status === "SUCCESS") return { replay: true, commission: 0, netAmount: 0 };
      }
      throw e;
    });

  if (settled.replay) {
    return { status: "SUCCESS" as const, bookingCode: booking.code, idempotentReplay: true };
  }

  try {
    await moveStatus(booking.id, "CONFIRMED");
  } catch {
    // e.g. already EN_ROUTE/IN_PROGRESS — payment state stays consistent regardless
  }

  await audit("SYSTEM", null, "PAYMENT_VERIFIED", "Payment", payment.id, {
    bookingId: booking.id,
    amount: payment.amount,
    commission: settled.commission,
  });
  await Promise.all([
    notifyUser(booking.customerId, "Payment received", `${booking.code} is confirmed. Amount ₹${payment.amount}.`, "/bookings", "SUCCESS"),
    notifyProvider(
      booking.providerId,
      "Booking confirmed",
      `${booking.code} confirmed. Payout ₹${settled.netAmount} after commission.`,
      "/providers/dashboard",
      "SUCCESS"
    ),
  ]);

  return { status: "SUCCESS" as const, bookingCode: booking.code };
}

export async function refundPayment(paymentId: string) {
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (payment.status !== "SUCCESS") throw new Error("Only successful payments can be refunded");

  if (payment.mode === "razorpay") {
    // Resolve the gateway PAYMENT id (gatewayRef is the order id).
    let gatewayPaymentId = payment.providerPaymentId && payment.providerPaymentId !== payment.gatewayRef
      ? payment.providerPaymentId
      : null;
    if (!gatewayPaymentId && payment.gatewayRef) {
      try {
        const resp: any = await razorpayClient.orders.fetchPayments(payment.gatewayRef);
        const captured = (resp?.items || []).find((p: any) => p?.status === "captured");
        gatewayPaymentId = captured?.id ?? null;
      } catch (e: any) {
        await audit("ADMIN", undefined, "REFUND_PAYMENT_FAILED", "Payment", paymentId, { reason: e?.message || "gateway lookup failed" });
        throw new Error("Could not locate the gateway payment to refund. Please retry or refund manually.");
      }
    }
    if (!gatewayPaymentId) {
      await audit("ADMIN", undefined, "REFUND_PAYMENT_FAILED", "Payment", paymentId, { reason: "no gateway payment id" });
      throw new Error("This payment has no gateway reference; refund must be processed manually.");
    }

    let refundStatus: string | undefined;
    try {
      const result: any = await razorpayClient.payments.refund(gatewayPaymentId, { speed: "optimum" });
      refundStatus = result?.status;
    } catch (e: any) {
      await audit("ADMIN", undefined, "REFUND_PAYMENT_FAILED", "Payment", paymentId, { reason: e?.message || "gateway error" });
      throw new Error("Razorpay refund failed: " + (e?.message || "unknown error"));
    }
    // Only treat the refund as done if the gateway accepted it (processed or pending).
    if (refundStatus && refundStatus !== "processed" && refundStatus !== "pending") {
      await audit("ADMIN", undefined, "REFUND_PAYMENT_FAILED", "Payment", paymentId, { reason: "gateway status: " + refundStatus });
      throw new Error("Razorpay refund was not accepted by the gateway.");
    }
  }

  await prisma.payment.update({ where: { id: paymentId }, data: { status: "REFUNDED", refundedAt: new Date() } });
  const booking = await prisma.booking.update({
    where: { id: payment.bookingId },
    data: { paymentStatus: "REFUNDED", status: "REFUNDED" },
  });
  await prisma.payout.deleteMany({ where: { bookingId: booking.id, status: { in: ["PENDING", "PROCESSING"] } } });
  await notifyUser(booking.customerId, "Refund processed", `₹${payment.amount} refunded for ${booking.code}.`, "/bookings", "INFO");
  await audit("ADMIN", undefined, "REFUND_PAYMENT", "Payment", paymentId, { amount: payment.amount });
  return { refunded: true };
}