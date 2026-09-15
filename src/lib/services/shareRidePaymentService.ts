import { prisma } from "../db";
import { getSettings } from "../config";
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

async function fetchCapturedPayment(orderId: string | null): Promise<{ id: string | null; amount: number } | null> {
  if (!orderId) return null;
  try {
    const resp: any = await razorpayClient.orders.fetchPayments(orderId);
    const items: any[] = resp?.items || [];
    const captured = items.find((p: any) => p?.status === "captured");
    return captured ? { id: captured.id ?? null, amount: captured.amount ?? 0 } : null;
  } catch {
    throw new Error("Payment status could not be verified with the gateway.");
  }
}

/**
 * Step 1: create a payment intent for a share-ride seat booking.
 */
export async function initiateShareRidePayment(rideId: string) {
  const ride = await prisma.sharedRideBooking.findUniqueOrThrow({ where: { id: rideId } });
  if (!["ACCEPTED"].includes(ride.status)) throw new Error("Ride is not payable in its current state");
  if (ride.paymentStatus === "PAID") throw new Error("Already paid");

  const mode = process.env.PAYMENT_MODE || "simulated";
  const isRazorpay = hasRazorpayCreds() && mode === "razorpay";

  if (isRazorpay) {
    const order = await razorpayClient.orders.create({
      amount: expectedAmountPaise(ride.totalAmount),
      currency: "INR",
      receipt: ride.id,
      notes: { rideId, customerId: ride.passengerPhone },
    });
    const payment = await prisma.shareRidePayment.create({
      data: { bookingId: ride.id, amount: ride.totalAmount, status: "PENDING", mode: "razorpay", gatewayRef: order.id, providerPaymentId: order.id },
    });
    await prisma.sharedRideBooking.update({ where: { id: ride.id }, data: { paymentStatus: "PENDING" } });
    return payment;
  }

  const payment = await prisma.shareRidePayment.create({
    data: { bookingId: ride.id, amount: ride.totalAmount, status: "PENDING", mode: "simulated", gatewayRef: `sim_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}` },
  });
  await prisma.sharedRideBooking.update({ where: { id: ride.id }, data: { paymentStatus: "PENDING" } });
  return payment;
}

/**
 * Step 2: gateway callback verification. Splits: platform keeps commission,
 * driver gets the rest as a pending payout.
 */
export async function verifyShareRidePayment(gatewayRef: string, outcome: "success" | "failure") {
  const payment = await prisma.shareRidePayment.findFirst({ where: { gatewayRef }, orderBy: { createdAt: "desc" } });
  if (!payment) throw new Error("Unknown payment reference");
  const ride = await prisma.sharedRideBooking.findUniqueOrThrow({ where: { id: payment.bookingId }, include: { ride: true } });

  if (outcome === "failure") {
    await prisma.shareRidePayment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    await prisma.sharedRideBooking.update({ where: { id: ride.id }, data: { paymentStatus: "FAILED" } });
    await audit("SYSTEM", null, "SHARE_RIDE_PAYMENT_FAILED", "ShareRidePayment", payment.id, { gatewayRef });
    return { status: "FAILED" as const };
  }

  // Idempotency guard.
  if (paymentSettled(payment.status, ride.paymentStatus)) {
    return { status: "SUCCESS" as const, idempotentReplay: true };
  }

  let gatewayPaymentId: string | null = null;
  if (payment.mode === "razorpay") {
    const captured = await fetchCapturedPayment(payment.gatewayRef);
    if (!captured) {
      await prisma.shareRidePayment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      await prisma.sharedRideBooking.update({ where: { id: ride.id }, data: { paymentStatus: "FAILED" } });
      return { status: "FAILED" as const, error: "Payment not captured by Razorpay" };
    }
    if (captured.amount !== expectedAmountPaise(ride.totalAmount)) {
      await prisma.shareRidePayment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      await prisma.sharedRideBooking.update({ where: { id: ride.id }, data: { paymentStatus: "FAILED" } });
      return { status: "FAILED" as const, error: "Amount mismatch" };
    }
    gatewayPaymentId = captured.id ?? null;
  }

  const commissionRate = Number(process.env.SHARE_RIDE_COMMISSION_PCT || 15) / 100;
  const result = await prisma
    .$transaction(
      async (tx) => {
        const freshPayment = await tx.shareRidePayment.findUnique({ where: { id: payment.id } });
        const freshRide = await tx.sharedRideBooking.findUniqueOrThrow({ where: { id: ride.id }, include: { ride: true } });
        if (freshPayment && paymentSettled(freshPayment.status, freshRide.paymentStatus)) return { replay: true };

        const commission = roundMoney(freshRide.totalAmount * commissionRate);
        const netAmount = roundMoney(freshRide.totalAmount - commission);

        await tx.shareRidePayment.update({
          where: { id: payment.id },
          data: { status: "SUCCESS", verifiedAt: new Date(), ...(gatewayPaymentId ? { providerPaymentId: gatewayPaymentId } : {}) },
        });
        await tx.sharedRideBooking.update({ where: { id: freshRide.id }, data: { paymentStatus: "PAID" } });
        await tx.shareRidePayout.create({
          data: {
            bookingId: freshRide.id, driverName: freshRide.ride.driverName, driverPhone: freshRide.ride.driverPhone,
            grossAmount: freshRide.totalAmount, commissionAmount: commission, netAmount, status: "PENDING",
          },
        });
        return { replay: false, commission, netAmount };
      },
      { isolationLevel: "Serializable", maxWait: 5000, timeout: 20000 }
    )
    .catch(async (e: any) => {
      if (e?.code === "P2002" || e?.code === "P2034") {
        const check = await prisma.shareRidePayment.findUnique({ where: { id: payment.id } });
        if (check && check.status === "SUCCESS") return { replay: true, commission: 0, netAmount: 0 };
      }
      throw e;
    });

  if (result.replay) return { status: "SUCCESS" as const, idempotentReplay: true };

  await audit("SYSTEM", null, "SHARE_RIDE_PAYMENT_VERIFIED", "ShareRidePayment", payment.id, { rideId: ride.id, commission: result.commission });
  return { status: "SUCCESS" as const, driverName: ride.ride.driverName, driverPhone: ride.ride.driverPhone, commission: result.commission, netAmount: result.netAmount };
}
