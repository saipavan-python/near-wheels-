import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { parseTripIntent } from "@/lib/services/budgetParser";
import { resolveLocation } from "@/lib/services/locationService";
import { getRoute } from "@/lib/services/routingService";
import { calculateTripCost, compareBudget } from "@/lib/services/tripCostService";
import { prisma } from "@/lib/db";
import { roadDistanceKm } from "@/lib/geo";

export const runtime = "nodejs";

/**
 * POST /api/ai/trip-plan
 * Deterministic budget trip planner — LLM never calculates costs.
 * Input: { message?: string, budget?: number, from?: string, to?: string, pax?: number, days?: number, vehicleCategory?: string, vehicleModel?: string, withDriver?: boolean, roundTrip?: boolean }
 * If message is given, intent is parsed via budgetParser (supports Telugu mixed).
 * Budget is compared to deterministic total (vehicle+driver+fuel+toll+parking).
 * Returns: tripCost, budgetComparison, distance, options (actual vehicles)
 */

interface Body {
  message?: string;
  budget?: number;
  from?: string;
  to?: string;
  fromLat?: number;
  fromLng?: number;
  toLat?: number;
  toLng?: number;
  pax?: number;
  days?: number;
  hours?: number;
  vehicleCategory?: string;
  vehicleModel?: string;
  vehicleId?: string;
  driverRequired?: boolean;
  withDriver?: boolean;
  roundTrip?: boolean;
}

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as Body;

  // If free-form message provided, parse intent deterministically first
  let intentBudget = b.budget;
  let intentFrom = b.from;
  let intentTo = b.to;
  let intentPax = b.pax;
  let intentDays = b.days;
  let intentCategory = b.vehicleCategory;
  let intentModel = b.vehicleModel;
  let intentWithDriver = b.withDriver ?? b.driverRequired;
  let intentRoundTrip = b.roundTrip;

  if (b.message) {
    const parsed = parseTripIntent(String(b.message));
    if (parsed.budget != null) intentBudget = parsed.budget;
    if (parsed.from) intentFrom = parsed.from;
    if (parsed.to) intentTo = parsed.to;
    if (parsed.pax != null) intentPax = parsed.pax;
    if (parsed.days != null) intentDays = parsed.days;
    if (parsed.vehicleCategory) intentCategory = parsed.vehicleCategory;
    if (parsed.vehicleModel) intentModel = parsed.vehicleModel;
    if (parsed.withDriver != null) intentWithDriver = parsed.withDriver;
    if (parsed.roundTrip != null) intentRoundTrip = parsed.roundTrip;
  }

  // Validate budget
  if (intentBudget != null && (isNaN(intentBudget) || intentBudget <= 0)) return fail("Invalid budget");
  if (!intentFrom && b.fromLat == null) {
    // Allow missing from/to for discovery mode but return need_location
    if (!intentTo) {
      return fail("Provide pickup and destination", 422, { code: "NEED_LOCATIONS", need: ["from", "to"] });
    }
  }

  // Resolve coords
  let fromLat = b.fromLat ?? null;
  let fromLng = b.fromLng ?? null;
  let toLat = b.toLat ?? null;
  let toLng = b.toLng ?? null;

  let fromName = intentFrom || null;
  let toName = intentTo || null;

  if ((fromLat == null || fromLng == null) && intentFrom) {
    const r = await resolveLocation(intentFrom);
    if (r.resolved) {
      fromLat = r.resolved.lat;
      fromLng = r.resolved.lng;
      fromName = r.resolved.name;
    } else if (r.ambiguous) {
      return Response.json(
        { ok: false, error: "ambiguous_location", field: "from", options: r.candidates.map((c) => ({ id: c.id, label: [c.name, c.type, c.district].filter(Boolean).join(", "), lat: c.lat, lng: c.lng })) },
        { status: 300 }
      );
    } else {
      return fail(`Could not find pickup location "${intentFrom}"`, 422, { code: "NO_LOCATION", field: "from" });
    }
  }
  if ((toLat == null || toLng == null) && intentTo) {
    const r = await resolveLocation(intentTo);
    if (r.resolved) {
      toLat = r.resolved.lat;
      toLng = r.resolved.lng;
      toName = r.resolved.name;
    } else if (r.ambiguous) {
      return Response.json(
        { ok: false, error: "ambiguous_location", field: "to", options: r.candidates.map((c) => ({ id: c.id, label: [c.name, c.type, c.district].filter(Boolean).join(", "), lat: c.lat, lng: c.lng })) },
        { status: 300 }
      );
    } else {
      return fail(`Could not find destination "${intentTo}"`, 422, { code: "NO_LOCATION", field: "to" });
    }
  }

  if (fromLat == null || fromLng == null || toLat == null || toLng == null) {
    return fail("Both pickup and destination are required for cost estimation", 422, { code: "NEED_LOCATIONS" });
  }

  // Distance
  const route = await getRoute({ fromLat, fromLng, toLat, toLng, roundTrip: !!intentRoundTrip });
  const totalKm = route.totalKm;

  // Find candidate vehicles (real inventory) near origin
  const days = Math.max(1, intentDays ?? 1);
  let vehicles: Array<{ id: string; providerId: string; title: string; category: string; fuelType: string | null; make: string; model: string }> = [];

  if (b.vehicleId) {
    const v = await prisma.vehicle.findUnique({ where: { id: b.vehicleId } });
    if (v) vehicles = [{ id: v.id, providerId: v.providerId, title: v.title, category: v.category, fuelType: v.fuelType, make: v.make, model: v.model }];
  } else {
    // Search up to 60km from origin, filter by category/model if specified
    const allVehicles = await prisma.vehicle.findMany({ where: { status: "ACTIVE" }, include: { provider: true } });
    const filtered = allVehicles.filter((v) => {
      if (v.provider.status !== "ACTIVE") return false;
      const d = roadDistanceKm(fromLat!, fromLng!, v.provider.lat, v.provider.lng);
      if (d > 60) return false;
      if (intentCategory && v.category !== intentCategory) {
        // allow CAR to match SUV when customer says car
        if (!(intentCategory === "CAR" && v.category === "SUV")) return false;
      }
      if (intentModel && !`${v.make} ${v.model}`.toLowerCase().includes(intentModel.toLowerCase())) return false;
      if (intentPax && v.seats < intentPax) return false;
      return true;
    });
    // rank by distance
    const ranked = filtered
      .map((v) => ({ v, d: roadDistanceKm(fromLat!, fromLng!, v.provider.lat, v.provider.lng) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .map((x) => x.v);
    vehicles = ranked.map((v) => ({ id: v.id, providerId: v.providerId, title: v.title, category: v.category, fuelType: v.fuelType, make: v.make, model: v.model }));
    if (vehicles.length === 0) {
      // No vehicle filter matched — still show fuel/toll estimate without vehicle segment
      vehicles = [];
    }
  }

  // Compute costs for each vehicle option
  const options: Array<{ vehicleId: string | null; title: string; category: string; tripCost: Awaited<ReturnType<typeof calculateTripCost>> }> = [];

  if (vehicles.length > 0) {
    for (const v of vehicles) {
      const tc = await calculateTripCost({
        vehicleId: v.id,
        vehicleProviderId: v.providerId,
        vehicleCategory: v.category,
        vehicleFuelType: v.fuelType,
        withDriver: !!intentWithDriver,
        fromLat,
        fromLng,
        toLat,
        toLng,
        roundTrip: !!intentRoundTrip,
        distanceKmOverride: totalKm,
        durationDays: days,
        durationHours: b.hours ?? undefined,
      });
      options.push({ vehicleId: v.id, title: v.title, category: v.category, tripCost: tc });
    }
  } else {
    // No vehicle candidate — still estimate fuel/toll/parking for transparency
    const tc = await calculateTripCost({
      vehicleId: undefined,
      vehicleProviderId: "",
      vehicleCategory: intentCategory ?? null,
      vehicleFuelType: null,
      withDriver: !!intentWithDriver,
      fromLat,
      fromLng,
      toLat,
      toLng,
      roundTrip: !!intentRoundTrip,
      distanceKmOverride: totalKm,
      durationDays: days,
    });
    options.push({ vehicleId: null, title: "Select a vehicle to confirm price", category: intentCategory || "VEHICLE", tripCost: tc });
  }

  // Pick best (cheapest total) for budget comparison
  const cheapest = [...options].sort((a, b) => a.tripCost.total - b.tripCost.total)[0];
  const bestMatch = options[0]; // distance-ranked first
  const budgetComparison = intentBudget != null
    ? compareBudget(intentBudget, cheapest.tripCost.total, cheapest.tripCost.confidence)
    : null;

  // Budget alternatives: if over budget, suggest cheaper
  const alternatives = budgetComparison && !budgetComparison.possible
    ? options.filter((o) => o.tripCost.total < cheapest.tripCost.total + 500).slice(0, 2)
    : [];

  // Rank destinations mode: if caller omitted vehicle specifics, provide 3 ranked options
  const ranking = options
    .map((o, idx) => ({
      rank: idx === 0 ? "BEST_MATCH" as const : cheapest.vehicleId === o.vehicleId ? "CHEAPEST" as const : "COMFORTABLE" as const,
      ...o,
    }))
    // Ensure BEST_MATCH is distance-closest, CHEAPEST is cheapest, COMFORTABLE is balanced (rating not available here — keep as second)
    .sort((a, b) => {
      const order = { BEST_MATCH: 0, CHEAPEST: 1, COMFORTABLE: 2 } as Record<string, number>;
      return order[a.rank] - order[b.rank];
    });

  return ok({
    intent: {
      budget: intentBudget ?? null,
      from: fromName,
      to: toName,
      fromLat,
      fromLng,
      toLat,
      toLng,
      pax: intentPax ?? null,
      days,
      roundTrip: !!intentRoundTrip,
      vehicleCategory: intentCategory ?? null,
      vehicleModel: intentModel ?? null,
      withDriver: !!intentWithDriver,
    },
    distance: { oneWayKm: route.oneWayKm, totalKm: route.totalKm, roundTrip: route.roundTrip, source: route.source, note: route.note, estimatedTimeMin: route.estimatedTimeMinTotal },
    options: ranking.map((r) => ({
      rank: r.rank,
      vehicleId: r.vehicleId,
      title: r.title,
      category: r.category,
      total: r.tripCost.total,
      confidence: r.tripCost.confidence,
      disclaimer: r.tripCost.disclaimer,
      lines: r.tripCost.lines,
    })),
    cheapest: cheapest
      ? { vehicleId: cheapest.vehicleId, title: cheapest.title, total: cheapest.tripCost.total, confidence: cheapest.tripCost.confidence }
      : null,
    bestMatch: bestMatch ? { vehicleId: bestMatch.vehicleId, title: bestMatch.title, total: bestMatch.tripCost.total } : null,
    budgetComparison,
    alternatives: alternatives.map((a) => ({ vehicleId: a.vehicleId, title: a.title, total: a.tripCost.total })),
    message:
      budgetComparison == null
        ? `Estimated total for ${fromName} → ${toName} is ${cheapest.tripCost.total.toLocaleString("en-IN")} INR (distance ${totalKm} km). Add your budget to check if this fits.`
        : budgetComparison.possible
          ? `Yes, this trip looks possible within your ₹${budgetComparison.budget.toLocaleString("en-IN")} budget. Estimated trip cost: ₹${budgetComparison.estimatedTotal.toLocaleString("en-IN")}. Remaining: ₹${budgetComparison.delta.toLocaleString("en-IN")}.`
          : `This trip may not fit your ₹${budgetComparison.budget.toLocaleString("en-IN")} budget. Estimated total is ₹${budgetComparison.estimatedTotal.toLocaleString("en-IN")}. Additional ~₹${Math.abs(budgetComparison.delta).toLocaleString("en-IN")} required.`,
  });
}

export async function GET(req: NextRequest) {
  // Allow GET for simple debug: ?from=Guntur&to=Tirupati&budget=10000&days=2
  const sp = req.nextUrl.searchParams;
  const body: Body = {};
  if (sp.get("from")) body.from = sp.get("from")!;
  if (sp.get("to")) body.to = sp.get("to")!;
  if (sp.get("budget")) body.budget = Number(sp.get("budget"));
  if (sp.get("days")) body.days = Number(sp.get("days"));
  if (sp.get("fromLat")) body.fromLat = Number(sp.get("fromLat"));
  if (sp.get("fromLng")) body.fromLng = Number(sp.get("fromLng"));
  if (sp.get("toLat")) body.toLat = Number(sp.get("toLat"));
  if (sp.get("toLng")) body.toLng = Number(sp.get("toLng"));
  if (sp.get("vehicleCategory")) body.vehicleCategory = sp.get("vehicleCategory")!;
  if (sp.get("withDriver")) body.withDriver = sp.get("withDriver") === "true";
  if (sp.get("roundTrip")) body.roundTrip = sp.get("roundTrip") === "true";
  const fakeReq = { json: async () => body } as NextRequest;
  // delegate to POST logic by calling inline (simpler: replicate minimal)
  // Instead just construct equivalent response via POST handler
  const req2 = new NextRequest(req.url, { method: "POST", body: JSON.stringify(body) });
  return POST(req2);
}
