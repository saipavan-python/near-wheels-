import type { ResultCard, SortPriority } from "../types";

/**
 * Matching engine (spec §27–28). Weights are configurable platform settings;
 * intent presets + customer-stated priorities adjust them dynamically.
 */
export function scoreCandidate(input: {
  needMatch: number; // 0..1 exact requirement fit
  availableNow: boolean;
  distanceKm: number | null;
  maxRadiusKm: number;
  priceFrom: number | null;
  cheapestAmong: number | null; // lowest price in result set (for normalization)
  rating: number;
  verified: boolean;
  weights: Record<string, number>;
}): number {
  const w = input.weights;
  const availabilityScore = input.availableNow ? 1 : 0.15;
  const dist = input.distanceKm == null ? 0.5 : Math.max(0, 1 - input.distanceKm / input.maxRadiusKm);
  let priceScore = 0.5;
  if (input.priceFrom != null && input.cheapestAmong) {
    priceScore = Math.max(0, 1 - input.priceFrom / (input.cheapestAmong * 2.2));
  }
  const ratingScore = Math.min(1, input.rating / 5);
  const verificationScore = input.verified ? 1 : 0;

  return (
    input.needMatch * (w.needMatch || 0) +
    availabilityScore * (w.availability || 0) +
    dist * (w.distance || 0) +
    priceScore * (w.price || 0) +
    ratingScore * (w.rating || 0) +
    verificationScore * (w.verification || 0)
  );
}

export function sortCards(cards: ResultCard[], priority: SortPriority = "BEST_MATCH"): ResultCard[] {
  const arr = [...cards];
  switch (priority) {
    case "NEAREST":
      return arr.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
    case "CHEAPEST":
      return arr.sort((a, b) => (a.priceFrom ?? Infinity) - (b.priceFrom ?? Infinity));
    case "BEST_RATED":
      return arr.sort((a, b) => b.rating - a.rating);
    case "FASTEST":
      return arr.sort((a, b) => Number(b.availableNow) - Number(a.availableNow) || (a.etaMin ?? 999) - (b.etaMin ?? 999));
    default:
      return arr;
  }
}
