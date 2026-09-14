import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return fail("Authentication required", 401);
  const body = await req.json().catch(() => ({}));
  const requestedSeats: number[] = Array.isArray(body.seatNumbers) ? Array.from(new Set(body.seatNumbers.map(Number))) : [];
  if (!requestedSeats.length || requestedSeats.some((seat) => !Number.isInteger(seat) || seat < 1)) return fail("Select at least one valid seat");

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const pkg = await tx.yatraBusPackage.findFirst({ where: { id: params.id, status: "PUBLISHED", isPublished: true, isActive: true } });
      if (!pkg || pkg.departureDate < new Date()) throw new Error("This journey is no longer bookable");
      if (requestedSeats.length > pkg.totalSeats - pkg.bookedSeats) throw new Error("Not enough seats available");

      const available = await tx.yatraSeat.findMany({
        where: { packageId: pkg.id, number: { in: requestedSeats }, status: "AVAILABLE", bookingId: null },
        select: { id: true, number: true },
      });
      if (available.length !== requestedSeats.length) throw new Error("One or more selected seats are no longer available");

      const created = await tx.yatraBooking.create({
        data: {
          packageId: pkg.id,
          customerId: session.userId,
          operatorId: pkg.operatorId,
          bookingReference: `NW-YAT-${Date.now().toString(36).toUpperCase()}`,
          seatNumbers: JSON.stringify(requestedSeats.sort((a, b) => a - b)),
          passengerCount: requestedSeats.length,
          pricePerHead: pkg.pricePerHead,
          totalAmount: pkg.pricePerHead * requestedSeats.length,
          paymentStatus: "PENDING",
          bookingStatus: "PENDING",
        },
      });
      await tx.yatraSeat.updateMany({ where: { id: { in: available.map((seat) => seat.id) }, status: "AVAILABLE", bookingId: null }, data: { status: "BOOKED", bookingId: created.id } });
      await tx.yatraBusPackage.update({ where: { id: pkg.id }, data: { bookedSeats: { increment: requestedSeats.length } } });
      return created;
    });
    return ok({ booking }, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Unable to reserve seats", 409);
  }
}
