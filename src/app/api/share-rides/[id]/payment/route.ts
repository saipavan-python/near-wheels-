import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { ok, fail } from "@/lib/http";
import { initiateShareRidePayment, verifyShareRidePayment } from "@/lib/services/shareRidePaymentService";

/**
 * POST /api/share-rides/{id}/payment  — initiate payment for a booked seat.
 * PUT  /api/share-rides/{id}/payment  — verify payment (gateway callback / simulated).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{  id: string  }> }) {
  const session = await getSession();
  if (!session) return fail("Login required", 401);
  const b = await req.json().catch(() => ({}));
  if (b.outcome !== undefined) return fail("Use PUT to verify", 400);
  try {
    const payment = await initiateShareRidePayment(String((await params).id));
    const isRazorpay = payment.mode === "razorpay";
    return ok({ payment: { id: payment.id, gatewayRef: payment.gatewayRef, amount: payment.amount, status: payment.status }, ...(isRazorpay && { razorpayOrderId: (payment as any).razorpayOrderId }), simulated: !isRazorpay });
  } catch (e: any) {
    return fail(e?.message || "Could not start payment", 400);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{  id: string  }> }) {
  const session = await getSession();
  const b = await req.json().catch(() => ({}));
  const ref = String(b.gatewayRef || b.paymentId || "");
  if (!ref) return fail("payment reference required", 400);
  const outcome = b.outcome === "failure" ? "failure" : "success";
  try {
    const result = await verifyShareRidePayment(ref, outcome);
    if (result.status === "SUCCESS") return ok({ status: "SUCCESS", ...(result.idempotentReplay ? { idempotentReplay: true } : { driverName: result.driverName, driverPhone: result.driverPhone }) });
    return ok({ status: result.status });
  } catch (e: any) {
    return fail(e?.message || "Verification failed", 400);
  }
}
