import { getSession } from "@/lib/session";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/db";
import { bookingsForProvider } from "@/lib/services/bookingService";

export const runtime = "nodejs";

export async function GET() {
  const session = getSession();
  if (!session) return fail("Login required", 401);
  const provider = await prisma.provider.findFirst({
    where: { userId: session.userId },
    include: {
      subscription: { include: { plan: true } },
      vehicles: true,
      driverProfile: true,
      garageProfile: true,
      farmEquipment: true,
      droneProfile: true,
      pricingRules: true,
      notifications: { where: {}, orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!provider) return ok({ provider: null });

  const bookings = await bookingsForProvider(provider.id);
  const paid = await prisma.payout.aggregate({ where: { providerId: provider.id }, _sum: { netAmount: true, grossAmount: true, commissionAmount: true } });
  const reviews = await prisma.review.findMany({
    where: { providerId: provider.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { customer: { select: { name: true, phone: true } } },
  });

  return ok({
    provider,
    bookings,
    earnings: {
      gross: paid._sum.grossAmount || 0,
      commission: paid._sum.commissionAmount || 0,
      net: paid._sum.netAmount || 0,
    },
    reviews: reviews.map((r) => ({ rating: r.rating, comment: r.comment, at: r.createdAt, by: r.customer.name || "Customer" })),
  });
}

export const dynamic = "force-dynamic";