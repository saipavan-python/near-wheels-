import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/services/auditService";

export const runtime = "nodejs";

/**
 * GET /api/share-rides/[id]
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{  id: string  }> }) {
  const ride = await prisma.sharedRide.findUnique({
    where: { id: (await params).id },
    include: { bookings: true },
  });

  if (!ride) return fail("Ride not found", 404);

  return ok({ ride });
}

/**
 * POST /api/share-rides/[id]/request
 * Book/Request seats on this ride
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{  id: string  }> }) {
  const b = await req.json().catch(() => ({}));
  const passengerName = b.passengerName?.trim();
  const passengerPhone = b.passengerPhone?.trim();
  const passengerEmail = b.passengerEmail?.trim();
  const seatsBooked = Number(b.seatsBooked) || 1;
  const message = b.message?.trim();

  if (!passengerName || !passengerPhone) {
    return fail("Passenger name and valid mobile number are required.");
  }

  const ride = await prisma.sharedRide.findUnique({ where: { id: (await params).id } });
  if (!ride) return fail("Ride not found", 404);

  if (ride.availableSeats < seatsBooked) {
    return fail(`Only ${ride.availableSeats} seat(s) available.`);
  }

    const totalAmount = seatsBooked * ride.pricePerSeat;

    // Platform commission per booked seat (audit trail on every booking)
    const COMMISSION_PCT = Number(process.env.SHARE_RIDE_COMMISSION_PCT || 0);
    const platformFee = Math.round(totalAmount * COMMISSION_PCT / 100);

    const booking = await prisma.sharedRideBooking.create({
      data: {
        rideId: ride.id,
        passengerName,
        passengerPhone,
        passengerEmail,
        seatsBooked,
        totalAmount,
        platformFee,
        message,
        status: "ACCEPTED", // Auto-confirm
        tripOtp: String(Math.floor(100000 + Math.random() * 900000)),
      },
    });

    // Update available seats
    const updatedRide = await prisma.sharedRide.update({
      where: { id: ride.id },
      data: {
        availableSeats: Math.max(0, ride.availableSeats - seatsBooked),
      },
    });

    return ok({ booking, ride: updatedRide, driverPhone: ride.driverPhone, driverName: ride.driverName, message: "Seat request confirmed!" });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{  id: string  }> }) {
  const session = await getSession();
  if (!session) return fail("Login required", 401);
  const ride = await prisma.sharedRide.findUnique({ where: { id: (await ctx.params).id } });
  if (!ride) return fail("Ride not found", 404);
  if (session.role !== "ADMIN") {
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || ride.driverPhone !== user.phone) return fail("Not authorized", 403);
  }
  await prisma.sharedRide.delete({ where: { id: (await ctx.params).id } });
  await audit("USER", session.userId, "SHARE_RIDE_DELETE", "SharedRide", (await ctx.params).id, {});
  return ok({ deleted: true });
}
