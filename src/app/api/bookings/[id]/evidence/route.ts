import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Photo evidence at pickup / drop-off.
 * POST { phase: "PICKUP" | "DROPOFF", photoUrl } — stores evidence (customer or provider).
 * GET — returns evidence + OTP status for the participants.
 */
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const session = getSession();
  if (!session) return fail("Login required", 401);
  const booking = await prisma.booking.findUnique({
    where: { id: ctx.params.id },
    select: {
      id: true,
      customerId: true,
      providerId: true,
      tripOtp: true,
      otpVerifiedAt: true,
      endOtpVerifiedAt: true,
      pickupPhotoUrl: true,
      dropoffPhotoUrl: true,
      startedAt: true,
      endedAt: true,
      status: true,
    },
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
    evidence: {
      pickupPhotoUrl: booking.pickupPhotoUrl,
      dropoffPhotoUrl: booking.dropoffPhotoUrl,
      otpVerifiedAt: booking.otpVerifiedAt,
      endOtpVerifiedAt: booking.endOtpVerifiedAt,
      startedAt: booking.startedAt,
      endedAt: booking.endedAt,
      status: booking.status,
    },
    // The rider shares this OTP with the driver to authorise the trip.
    tripOtp: isCustomer || isProvider || isAdmin ? booking.tripOtp : null,
  });
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const session = getSession();
  if (!session) return fail("Login required", 401);
  const b = await req.json().catch(() => ({}));
  const phase = String(b.phase || "").toUpperCase();
  const photoUrl = String(b.photoUrl || "").trim();
  if (!["PICKUP", "DROPOFF"].includes(phase)) return fail("phase must be PICKUP or DROPOFF");
  if (!photoUrl) return fail("photoUrl is required");

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

  const data =
    phase === "PICKUP"
      ? { pickupPhotoUrl: photoUrl }
      : { dropoffPhotoUrl: photoUrl };
  await prisma.booking.update({ where: { id: ctx.params.id }, data });
  return ok({ saved: true, photoUrl });
}