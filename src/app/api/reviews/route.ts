import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { refreshProviderAggregates } from "@/lib/services/qualityService";
import { audit } from "@/lib/services/auditService";

export const runtime = "nodejs";

export async function GET() {
  try {
    const reviews = await prisma.review.findMany({
      take: 4,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true, phone: true } },
        booking: { select: { code: true, kind: true } },
        provider: { select: { businessName: true } },
      },
    });
    return ok({
      reviews: reviews.map((r) => ({
        quote: r.comment || "Great service experience",
        name: r.customer?.name || "Customer",
        location: r.provider?.businessName || "Nearby",
        type: r.booking?.kind || "Service",
        rating: r.rating,
      })),
    });
  } catch (e: any) {
    return fail("Failed to fetch reviews", 500);
  }
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return fail("Login required to review", 401);
  const b = await req.json().catch(() => ({}));
  const bookingId = String(b.bookingId || "");
  const rating = Math.max(1, Math.min(5, Number(b.rating) || 0));
  if (!bookingId || !rating) return fail("bookingId and rating required");

  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { review: true } });
  if (!booking) return fail("Booking not found", 404);
  if (booking.customerId !== session.userId) return fail("Not your booking", 403);
  if (booking.status !== "COMPLETED") return fail("You can review after the service is completed");
  if (booking.review) return fail("Already reviewed");

  await prisma.review.create({
    data: {
      bookingId,
      customerId: session.userId,
      providerId: booking.providerId,
      rating,
      comment: b.comment ? String(b.comment).slice(0, 500) : null,
    },
  });
  await refreshProviderAggregates(booking.providerId);
  return ok({ reviewed: true });
}

export async function DELETE(req: NextRequest) {
  const session = getSession();
  if (!session) return fail("Login required", 401);
  const b = await req.json().catch(() => ({}));
  const reviewId = String(b.reviewId || "");
  if (!reviewId) return fail("reviewId required", 400);
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) return fail("Review not found", 404);
  if (review.customerId !== session.userId && session.role !== "ADMIN") return fail("Not authorized", 403);
  await prisma.review.delete({ where: { id: reviewId } });
  await refreshProviderAggregates(review.providerId);
  return ok({ deleted: true });
}

export const dynamic = "force-dynamic";