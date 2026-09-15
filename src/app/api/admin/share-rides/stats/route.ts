import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";

/**
 * GET /api/admin/share-rides/stats
 * Share My Ride KPIs + platform commission for the admin dashboard.
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return fail("Admin only", 403);

  const since30 = new Date(Date.now() - 30 * 24 * 3600_000);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    totalRides,
    totalBookings,
    gmvAgg,
    commissionAgg,
    activeRides,
    bookingsByStatusRaw,
    thisMonthRides,
    thisMonthBookings,
    thisMonthCommissionAgg,
    recentRides,
  ] = await Promise.all([
    prisma.sharedRide.count(),
    prisma.sharedRideBooking.count(),
    prisma.sharedRideBooking.aggregate({ _sum: { totalAmount: true } }),
    prisma.sharedRideBooking.aggregate({ _sum: { platformFee: true } }),
    prisma.sharedRide.count({ where: { status: "ACTIVE" } }),
    prisma.sharedRideBooking.groupBy({ by: ["status"], _count: true }),
    prisma.sharedRide.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.sharedRideBooking.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.sharedRideBooking.aggregate({ where: { createdAt: { gte: startOfMonth } }, _sum: { platformFee: true } }),
    prisma.sharedRide.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { bookings: true } }),
  ]);

  const bookingsByStatus: Record<string, number> = {};
  for (const row of bookingsByStatusRaw) bookingsByStatus[row.status] = row._count;

  return ok({
    totals: {
      rides: totalRides,
      bookings: totalBookings,
      activeRides,
      gmv: gmvAgg._sum.totalAmount || 0,
      commission: commissionAgg._sum.platformFee || 0,
    },
    bookingsByStatus,
    thisMonth: {
      rides: thisMonthRides,
      bookings: thisMonthBookings,
      commission: thisMonthCommissionAgg._sum.platformFee || 0,
    },
    recentRides: recentRides.map((r) => ({
      id: r.id,
      driverName: r.driverName,
      driverPhone: r.driverPhone,
      verified: r.verified,
      fromLocation: r.fromLocation,
      toLocation: r.toLocation,
      travelDate: r.travelDate,
      departureTime: r.departureTime,
      vehicleTitle: r.vehicleTitle,
      totalSeats: r.totalSeats,
      availableSeats: r.availableSeats,
      pricePerSeat: r.pricePerSeat,
      status: r.status,
      bookings: r.bookings.map((b) => ({
        id: b.id,
        passengerName: b.passengerName,
        passengerPhone: b.passengerPhone,
        seatsBooked: b.seatsBooked,
        totalAmount: b.totalAmount,
        platformFee: b.platformFee,
        status: b.status,
        createdAt: b.createdAt,
      })),
    })),
  });
}
