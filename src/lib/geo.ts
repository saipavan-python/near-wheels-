export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Rough on-road factor vs straight-line distance for rural road networks. */
export const ROAD_FACTOR = 1.25;

export function roadDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  return round1(haversineKm(lat1, lng1, lat2, lng2) * ROAD_FACTOR);
}

/** ETA in minutes given distance; slower avg speed for rural/urban mix. */
export function etaMinutes(distanceKm: number, avgSpeedKmph = 28): number {
  return Math.max(2, Math.round((distanceKm / avgSpeedKmph) * 60));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Radius ladder for immediate searches (spec §13). */
export const IMMEDIATE_RADIUS_LADDER = [3, 7, 15, 30, 60];

export function nextRadius(current: number): number | null {
  for (const r of IMMEDIATE_RADIUS_LADDER) if (r > current) return r;
  return null;
}
