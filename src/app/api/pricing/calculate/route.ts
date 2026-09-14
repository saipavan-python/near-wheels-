import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { calculateTripCost } from "@/lib/services/tripCostService";
import { parseTripIntent } from "@/lib/services/budgetParser";

export const runtime = "nodejs";

/**
 * POST /api/pricing/calculate
 * Deterministic cost engine — frontend never calculates prices.
 * Body: { vehicleId, vehicleProviderId, withDriver, fromLat, fromLng, toLat, toLng, distanceKm, roundTrip, days, hours, toll, parking, vehicleCategory, vehicleFuelType }
 * Or free-form message: { message: "₹10000 Guntur to Tirupati 2 days Ertiga + driver" } -> parsed deterministically
 */

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));

  // Support free-form message parsing
  if (b.message && !b.fromLat) {
    const p = parseTripIntent(String(b.message));
    if (p.budget) b.budget = p.budget;
    if (p.from && !b.from) b.from = p.from;
    if (p.to && !b.to) b.to = p.to;
    if (p.days && !b.days) b.days = p.days;
    if (p.vehicleCategory && !b.vehicleCategory) b.vehicleCategory = p.vehicleCategory;
    if (p.vehicleModel && !b.vehicleModel) b.vehicleModel = p.vehicleModel;
    if (p.withDriver != null && b.withDriver == null) b.withDriver = p.withDriver;
  }

  const vehicleId = b.vehicleId ? String(b.vehicleId) : undefined;
  const vehicleProviderId = b.vehicleProviderId ? String(b.vehicleProviderId) : (b.providerId ? String(b.providerId) : "");
  const fromLat = b.fromLat != null ? Number(b.fromLat) : null;
  const fromLng = b.fromLng != null ? Number(b.fromLng) : null;
  const toLat = b.toLat != null ? Number(b.toLat) : null;
  const toLng = b.toLng != null ? Number(b.toLng) : null;
  const distanceKm = b.distanceKm != null ? Number(b.distanceKm) : (b.totalKm != null ? Number(b.totalKm) : null);

  if (!vehicleProviderId && !vehicleId) {
    // Allow fuel-only estimate if no vehicle selected (distance must be present)
    if ((fromLat == null || toLat == null) && distanceKm == null) return fail("vehicleProviderId or distance/from-to is required");
  }
  if ((fromLat == null || fromLng == null || toLat == null || toLng == null) && distanceKm == null) {
    return fail("Provide fromLat/fromLng/toLat/toLng or distanceKm");
  }

  try {
    const result = await calculateTripCost({
      vehicleId,
      vehicleProviderId: vehicleProviderId || "unknown",
      vehicleCategory: b.vehicleCategory ? String(b.vehicleCategory) : null,
      vehicleFuelType: b.vehicleFuelType ? String(b.vehicleFuelType) : null,
      driverProviderId: b.driverProviderId ? String(b.driverProviderId) : null,
      driverProfileId: b.driverProfileId ? String(b.driverProfileId) : null,
      withDriver: !!b.withDriver || !!b.driverRequired,
      fromLat: fromLat ?? 0,
      fromLng: fromLng ?? 0,
      toLat: toLat ?? 0,
      toLng: toLng ?? 0,
      roundTrip: !!b.roundTrip,
      distanceKmOverride: distanceKm,
      durationDays: b.days != null ? Number(b.days) : (b.durationDays != null ? Number(b.durationDays) : 1),
      durationHours: b.hours != null ? Number(b.hours) : (b.durationHours != null ? Number(b.durationHours) : undefined),
      tollOverride: b.toll != null ? Number(b.toll) : null,
      parkingOverride: b.parking != null ? Number(b.parking) : null,
      withAc: typeof b.withAc === "boolean" ? b.withAc : null,
    });
    return ok({ result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Cost calculation failed";
    return fail(msg, 500);
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const b: Record<string, string | number | boolean> = {};
  for (const [k, v] of sp.entries()) b[k] = v;
  if (b["distanceKm"]) b["distanceKm"] = Number(b["distanceKm"]);
  if (b["days"]) b["days"] = Number(b["days"]);
  if (b["roundTrip"]) b["roundTrip"] = b["roundTrip"] === "true";
  if (b["withDriver"]) b["withDriver"] = b["withDriver"] === "true";
  const fake = new NextRequest(req.url, { method: "POST", body: JSON.stringify(b) });
  return POST(fake);
}
