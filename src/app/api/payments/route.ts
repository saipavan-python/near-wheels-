import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { ok, fail } from "@/lib/http";
import { initiatePayment, verifyPayment } from "@/lib/services/paymentService";
import { audit } from "@/lib/services/auditService";
import Razorpay from "razorpay";

export const runtime = "nodejs";

const razorpayClient = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

function getWebhookSecret(): string {
  return process.env.RAZORPAY_WEBHOOK_SECRET || process.env.PAYMENT_WEBHOOK_SECRET || "";
}

/** Step 1: create a payment intent for a booking. */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return fail("Login required", 401);
  const { checkRateLimit, getClientIp } = await import("@/lib/rateLimit");
  const ip = getClientIp(req);
  const rl = checkRateLimit(`pay:init:${session.userId}:${ip}`, 5, 60_000);
  if (!rl.allowed) return fail("Too many payment attempts. Try again shortly.", 429);
  const b = await req.json().catch(() => ({}));
  if (!b.bookingId) return fail("bookingId required");
  try {
    const { prisma } = await import("@/lib/db");
    const booking = await prisma.booking.findUnique({ where: { id: String(b.bookingId) } });
    if (!booking) return fail("Booking not found", 404);
    if (booking.customerId !== session.userId && session.role !== "ADMIN") return fail("Not your booking", 403);
    const payment = await initiatePayment(String(b.bookingId));
    const isRazorpay = payment.mode === "razorpay";
    return ok({
      payment: { id: payment.id, gatewayRef: payment.gatewayRef, amount: payment.amount, status: payment.status },
      ...(isRazorpay && { razorpayOrderId: (payment as any).razorpayOrderId }),
      simulated: !isRazorpay,
    });
  } catch (e: any) {
    return fail(e?.message || "Could not start payment", 400);
  }
}

/**
 * Step 2: gateway callback verification.
 * Razorpay webhook signature verification added.
 */
export async function PUT(req: NextRequest) {
  const session = getSession();
  const webhookSecret = getWebhookSecret();
  const headerSecret = req.headers.get("x-webhook-secret");
  const isWebhook = webhookSecret && headerSecret === webhookSecret;

  if (!session && !isWebhook) return fail("Login required", 401);

  const { checkRateLimit, getClientIp } = await import("@/lib/rateLimit");
  const ip = getClientIp(req);
  const key = session ? `pay:verify:${session.userId}:${ip}` : `pay:verify:webhook:${ip}`;
  const rl = checkRateLimit(key, 10, 60_000);
  if (!rl.allowed) return fail("Too many verification attempts.", 429);

  const b = await req.json().catch(() => ({}));
  const ref = String(b.gatewayRef || b.paymentId || "");
  if (!ref) return fail("payment reference required");

  if (isWebhook && webhookSecret) {
    try {
      const body = JSON.stringify(b);
      const signature = req.headers.get("x-razorpay-signature") || "";
      const isValid = Razorpay.validateWebhookSignature(body, signature, webhookSecret);
      if (!isValid) return fail("Invalid Razorpay signature", 403);
    } catch (e) {
      console.error("Webhook signature verification failed");
      return fail("Invalid signature", 403);
    }
  }

  const outcome = b.outcome === "failure" ? "failure" : "success";
  try {
    if (session && !isWebhook) {
      const { prisma } = await import("@/lib/db");
      const payment = await prisma.payment.findFirst({ where: { gatewayRef: ref } });
      if (!payment) return fail("Unknown payment reference", 404);
      const booking = await prisma.booking.findUnique({ where: { id: payment.bookingId } });
      if (!booking) return fail("Booking not found", 404);
      if (booking.customerId !== session.userId && session.role !== "ADMIN") return fail("Not your payment", 403);
    }
    const result = await verifyPayment(ref, outcome);
    await audit(session?.userId ? session.role : "SYSTEM", session?.userId || null, "PAYMENT_CALLBACK", "Payment", ref, { outcome });
    if (result.status === "SUCCESS") return ok({ status: "SUCCESS", bookingCode: result.bookingCode });
    return ok({ status: "FAILED", message: "Payment could not be completed. You can try again." });
  } catch (e: any) {
    console.error("verify error");
    return fail("Verification failed", 400);
  }
}

export const dynamic = "force-dynamic";