import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

/** Public ride search -> short-lived CDN cache (Vercel edge), SWR on top. */
const CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=120";

/**
 * GET /api/share-rides
 * Search offered rides with filters: from, to, date
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from")?.trim() || "";
  const to = searchParams.get("to")?.trim() || "";
  const date = searchParams.get("date")?.trim() || "";

  const where: any = { status: { in: ["ACTIVE", "IN_PROGRESS"] } };

  if (from) {
    where.fromLocation = { contains: from };
  }
  if (to) {
    where.toLocation = { contains: to };
  }
  if (date) {
    where.travelDate = date;
  }

  const rides = await prisma.sharedRide.findMany({
    where,
    include: { bookings: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return ok({ rides }, { headers: { "Cache-Control": CACHE_CONTROL } });
}

/**
 * POST /api/share-rides
 * Offer a new ride
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const session = getSession();

  const driverName = b.driverName?.trim() || session?.name || "Verified Driver";
  const driverPhone = b.driverPhone?.trim() || "9876543210";
  const fromLocation = b.fromLocation?.trim();
  const toLocation = b.toLocation?.trim();
  const travelDate = b.travelDate?.trim();
  const departureTime = b.departureTime?.trim();
  const vehicleTitle = b.vehicleTitle?.trim() || "Maruti Suzuki Ertiga";
  const totalSeats = Number(b.totalSeats) || 4;
  const availableSeats = Number(b.availableSeats) || totalSeats;
  const pricePerSeat = Number(b.pricePerSeat) || 500;
  const stops = Array.isArray(b.stops) ? b.stops : [];
  const preferences = b.preferences || {};

  if (!fromLocation || !toLocation || !travelDate || !departureTime) {
    return fail("Please fill from location, destination, travel date and departure time.");
  }

  const ride = await prisma.sharedRide.create({
    data: {
      driverName,
      driverPhone,
      driverRating: 4.9,
      driverTotalRides: Math.floor(Math.random() * 50) + 10,
      verified: true,
      fromLocation,
      toLocation,
      travelDate,
      departureTime,
      vehicleTitle,
      vehicleCategory: b.vehicleCategory || "CAR",
      totalSeats,
      availableSeats,
      pricePerSeat,
      stopsJson: JSON.stringify(stops),
      preferencesJson: JSON.stringify(preferences),
      status: "ACTIVE",
    },
  });

  return ok({ ride, message: "Your ride has been published successfully!" });
}
