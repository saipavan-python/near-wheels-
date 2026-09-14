import { prisma } from "../db";
import type { Provider } from "@prisma/client";
import type { ResultCard } from "../types";

/** Provider quality score (spec §71) + trust badges (spec §72). */
export function qualityScore(p: {
  ratingAvg: number;
  ratingCount: number;
  completedJobs: number;
  cancelledJobs: number;
  acceptedRequests: number;
  totalRequests: number;
  isVerified: boolean;
}): number {
  const responseRate = p.totalRequests > 0 ? p.acceptedRequests / p.totalRequests : 0.5;
  const cancelRate = p.completedJobs > 0 ? p.cancelledJobs / (p.completedJobs + p.cancelledJobs) : 0.2;
  const score =
    (p.ratingAvg / 5) * 40 +
    Math.min(1, p.completedJobs / 25) * 20 +
    responseRate * 15 +
    (1 - cancelRate) * 10 +
    (p.isVerified ? 15 : 0);
  return Math.round(score);
}

export function trustBadges(p: Provider): ResultCard["badges"] {
  const badges: ResultCard["badges"] = [];
  if (p.isVerified) badges.push({ label: "Verified", icon: "" });
  if (p.ratingAvg >= 4.5 && p.ratingCount >= 3) badges.push({ label: "Highly Rated", icon: "" });
  if (p.responseTimeSec <= 60 && p.totalRequests > 0 && p.acceptedRequests / p.totalRequests >= 0.6)
    badges.push({ label: "Fast Response", icon: "" });
  if (p.completedJobs >= 10 && p.cancelledJobs / Math.max(1, p.completedJobs) <= 0.1)
    badges.push({ label: "Reliable", icon: "" });
  if (qualityScore(p) >= 80) badges.push({ label: "Top Provider", icon: "" });
  return badges.slice(0, 3);
}

export async function refreshProviderAggregates(providerId: string) {
  const agg = await prisma.review.aggregate({
    where: { providerId },
    _avg: { rating: true },
    _count: { rating: true },
  });
  await prisma.provider.update({
    where: { id: providerId },
    data: {
      ratingAvg: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : 0,
      ratingCount: agg._count.rating,
    },
  });
}
