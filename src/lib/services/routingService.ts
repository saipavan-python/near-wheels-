import { haversineKm, ROAD_FACTOR, round1, etaMinutes } from "../geo";
import { prisma } from "../db";

/**
 * Deterministic routing service — LLM never guesses distances.
 * Tries OSRM (if ROUTING_URL configured) else falls back to haversine * ROAD_FACTOR.
 * Always returns rounded km and ETA from backend, not AI.
 */

export interface RouteInput {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  roundTrip?: boolean; // if true, doubles one-way
}

export interface RouteResult {
  oneWayKm: number;
  totalKm: number; // oneWay * (roundTrip?2:1)
  roundTrip: boolean;
  estimatedTimeMinOneWay: number;
  estimatedTimeMinTotal: number;
  source: "OSRM" | "HAVERSINE_ESTIMATE";
  note: string;
}

const OSRM_TIMEOUT_MS = 3500;

async function tryOsrm(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<{ km: number; min: number } | null> {
  const base = process.env.ROUTING_URL?.replace(/\/$/, "");
  if (!base) return null;
  const url = `${base}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.routes?.[0]?.distance != null) {
      const km = round1(json.routes[0].distance / 1000);
      const min = Math.max(5, Math.round(json.routes[0].duration / 60));
      return { km, min };
    }
  } catch {
    // ignore — fallback to haversine
  }
  return null;
}

/**
 * Resolve place names to lat/lng via Location gazetteer when caller gives text.
 * If resolution fails, returns null (caller should surface need_location).
 */
export async function resolvePlaceToCoords(label: string): Promise<{ lat: number; lng: number; name: string } | null> {
  if (!label || !label.trim()) return null;
  const { resolveLocation } = await import("./locationService");
  const r = await resolveLocation(label);
  if (r.resolved) return { lat: r.resolved.lat, lng: r.resolved.lng, name: r.resolved.name };
  return null;
}

export async function getRoute(input: RouteInput): Promise<RouteResult> {
  const osrm = await tryOsrm({ lat: input.fromLat, lng: input.fromLng }, { lat: input.toLat, lng: input.toLng });

  let oneWayKm: number;
  let oneWayMin: number;
  let source: RouteResult["source"];

  if (osrm) {
    oneWayKm = osrm.km;
    oneWayMin = osrm.min;
    source = "OSRM";
  } else {
    const hav = haversineKm(input.fromLat, input.fromLng, input.toLat, input.toLng);
    oneWayKm = round1(hav * ROAD_FACTOR);
    oneWayMin = etaMinutes(oneWayKm);
    source = "HAVERSINE_ESTIMATE";
  }

  const roundTrip = !!input.roundTrip;
  const totalKm = round1(oneWayKm * (roundTrip ? 2 : 1));
  const totalMin = oneWayMin * (roundTrip ? 2 : 1);

  return {
    oneWayKm,
    totalKm,
    roundTrip,
    estimatedTimeMinOneWay: oneWayMin,
    estimatedTimeMinTotal: totalMin,
    source,
    note:
      source === "OSRM"
        ? `Distance via road routing`
        : `Estimated distance (road factor ${ROAD_FACTOR}× straight line) — may vary by route`,
  };
}

/**
 * Budget destination discovery helper: given origin, return configured popular destinations
 * within max budget hint (caller filters by cost).
 */
export async function listPopularDestinations(limit = 12): Promise<{ name: string; lat: number; lng: number; district?: string | null }[]> {
  const rows = await prisma.location.findMany({
    where: { popular: true },
    orderBy: [{ name: "asc" }],
    take: limit,
  });
  return rows.map((r) => ({ name: r.name, lat: r.lat, lng: r.lng, district: r.district }));
}
