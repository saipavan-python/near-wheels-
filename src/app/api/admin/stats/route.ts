import { getSession } from "@/lib/session";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/db";
import { aiQualityMetrics } from "@/lib/services/analyticsService";

export const runtime = "nodejs";

function requireAdmin() {
  const s = getSession();
  return s && s.role === "ADMIN" ? s : null;
}

export async function GET() {
  if (!requireAdmin()) return fail("Admin only", 403);

  const since30 = new Date(Date.now() - 30 * 24 * 3600_000);

  const [
    totalBookings,
    bookingsByStatusRaw,
    completed,
    gmvAgg,
    commissionAgg,
    providersByType,
    pendingProviders,
    customers,
    conversations,
    noResultEvents,
    searchEvents,
    recentBookings,
    topProviders,
  ] = await Promise.all([
    prisma.booking.count(),
    prisma.booking.groupBy({ by: ["status"], _count: true }),
    prisma.booking.count({ where: { status: "COMPLETED" } }),
    prisma.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } }),
    prisma.commissionRecord.aggregate({ _sum: { amount: true } }),
    prisma.provider.groupBy({ by: ["type"], _count: true }),
    prisma.provider.count({ where: { status: "PENDING_VERIFICATION" } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.conversation.count({ where: { createdAt: { gte: since30 } } }),
    prisma.analyticsEvent.count({ where: { kind: "ai_no_result", createdAt: { gte: since30 } } }),
    prisma.analyticsEvent.count({ where: { kind: "ai_search", createdAt: { gte: since30 } } }),
    prisma.booking.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.provider.findMany({
      orderBy: [{ ratingAvg: "desc" }],
      take: 5,
      select: { businessName: true, type: true, ratingAvg: true, completedJobs: true },
    }),
  ]);

  const bookingsByStatus: Record<string, number> = {};
  for (const row of bookingsByStatusRaw) bookingsByStatus[row.status] = row._count;

  const ai = await aiQualityMetrics();

  return ok({
    totals: {
      bookings: totalBookings,
      completed,
      gmv: gmvAgg._sum.amount || 0,
      commission: commissionAgg._sum.amount || 0,
      customers,
      conversations,
      pendingProviders,
    },
    bookingsByStatus,
    providersByType: Object.fromEntries(providersByType.map((p) => [p.type, p._count])),
    searchHealth: {
      searches30d: searchEvents,
      noResultRate: searchEvents ? noResultEvents / searchEvents : 0,
    },
    aiQuality: ai,
    recentBookings: recentBookings.map((b) => ({
      code: b.code,
      kind: b.kind,
      providerName: b.providerName,
      status: b.status,
      paymentStatus: b.paymentStatus,
      amount: b.totalAmount,
      at: b.createdAt,
    })),
    topProviders,
  });
}
