import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/db";
import { verifyTripOtp } from "@/lib/services/bookingService";

export const runtime = "nodejs";

/**
 * Trip OTP management.
 * GET  → returns tripOtp to the rider (or provider, for testing).
 * POST { otp } → validates the code; used before the "start" / "complete" action to gate the UI.
 */
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const session = getSession();
  if (!session) return fail("Login required", 401);
  const booking = await prisma.booking.findUnique({
    where: { id: ctx.params.id },
    select: { id: true, customerId: true, providerId: true, tripOtp: true, status: true },
  });
  if (!booking) return fail("Booking not found", 404);

  const isCustomer = booking.customerId === session.userId;
  const isAdmin = session.role === "ADMIN";
  let isProvider = false;
  if (session.role === "PROVIDER") {
    const p = await prisma.provider.findFirst({ where: { userId: session.userId } });
    isProvider = !!p && p.id === booking.providerId;
  }
  if (!isCustomer && !isProvider && !isAdmin) return fail("Not your booking", 403);

  return ok({
    tripOtp: booking.tripOtp,
    status: booking.status,
  });
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const session = getSession();
  if (!session) return fail("Login required", 401);
  const b = await req.json().catch(() => ({}));
  const otp = String(b.otp || "").trim();
  const phase = String(b.phase || "").toUpperCase() === "DROPOFF" ? "DROPOFF" : "PICKUP";
  if (!otp) return fail("otp is required");

  const booking = await prisma.booking.findUnique({ where: { id: ctx.params.id } });
  if (!booking) return fail("Booking not found", 404);
  const isCustomer = booking.customerId === session.userId;
  const isAdmin = session.role === "ADMIN";
  let isProvider = false;
  if (session.role === "PROVIDER") {
    const p = await prisma.provider.findFirst({ where: { userId: session.userId } });
    isProvider = !!p && p.id === booking.providerId;
  }
  if (!isCustomer && !isProvider && !isAdmin) return fail("Not your booking", 403);

  try {
    const valid = await verifyTripOtp(ctx.params.id, otp, phase);
    if (!valid) return fail("Invalid OTP — ask the rider for the correct 6-digit code", 403);
    return ok({ verified: true, phase });
  } catch (e: any) {
    return fail(e?.message || "OTP verification failed", 400);
  }
}