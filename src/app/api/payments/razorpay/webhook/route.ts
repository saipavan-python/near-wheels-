import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/db";
import { verifyPayment } from "@/lib/services/paymentService";
import Razorpay from "razorpay";

export const runtime = "nodejs";

function getWebhookSecret(): string {
  return process.env.RAZORPAY_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET || "";
}

/**
 * Razorpay webhook endpoint.
 * POST to /api/payments/razorpay/webhook
 * Razorpay sends the signature in x-razorpay-signature header.
 */
export async function POST(req: NextRequest) {
  const webhookSecret = getWebhookSecret();
  const razorpaySignature = req.headers.get("x-razorpay-signature") || "";

  if (!webhookSecret) {
    return fail("Webhook secret not configured", 500);
  }

  try {
    const body = await req.text();
    const isValid = Razorpay.validateWebhookSignature(body, razorpaySignature, webhookSecret);
    if (!isValid) {
      return fail("Invalid Razorpay webhook signature", 403);
    }

    const b = JSON.parse(body);
    const event = b.event;
    const paymentEntity = b.payload?.payment?.entity;

    if (!paymentEntity) {
      return ok({ received: true });
    }

    const orderId = paymentEntity.order_id;

    if (event === "payment.captured") {
      const payment = await prisma.payment.findFirst({
        where: { gatewayRef: orderId },
      });
      if (!payment || !payment.gatewayRef) {
        return fail("Payment not found for order: " + orderId, 404);
      }
      const result = await verifyPayment(payment.gatewayRef, "success");
      return ok({ status: "SUCCESS", bookingCode: result.bookingCode });
    }

    if (event === "payment.failed") {
      const payment = await prisma.payment.findFirst({
        where: { gatewayRef: orderId },
      });
      if (payment && payment.gatewayRef) {
        await verifyPayment(payment.gatewayRef, "failure");
      }
      return ok({ status: "FAILED" });
    }

    return ok({ received: true });
  } catch (e: any) {
    console.error("Webhook error");
    return fail("Webhook processing failed", 400);
  }
}
