import { getSettings } from "../config";
import { calculateFuelCost } from "./fuelService";
import { getRoute } from "./routingService";
import { quoteFromRule, findRuleForTarget } from "./pricingService";
import type { PriceLine } from "../types";

/**
 * Deterministic Trip Cost Engine — backend is single source of truth.
 * LLM must NOT perform numeric calculations; it explains this engine's result.
 *
 * Formula:
 *   VEHICLE COST + DRIVER COST + FUEL + TOLL + PARKING + OTHER = ESTIMATED TOTAL
 * Every line labelled CONFIRMED / ESTIMATE / PROVIDER_CONFIRMATION_REQUIRED.
 */

export interface TripCostInput {
  vehicleId?: string;
  vehicleProviderId: string;
  vehicleCategory?: string | null;
  vehicleFuelType?: string | null;
  // optional bundle
  driverProviderId?: string | null; // if driver separate
  driverProfileId?: string | null;
  withDriver?: boolean; // true if vehicle_with_driver bundle
  // routing
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  roundTrip?: boolean;
  distanceKmOverride?: number | null; // if caller already knows distance
  // duration
  durationDays?: number; // default 1
  durationHours?: number;
  // misc
  tollOverride?: number | null;
  parkingOverride?: number | null;
  withAc?: boolean | null;
}

export interface CostLine extends PriceLine {
  confidence: "CONFIRMED" | "ESTIMATE" | "PROVIDER_CONFIRMATION";
  source: string; // e.g. provider rule, fuel estimate, toll estimate
}

export interface TripCostResult {
  distance: { oneWayKm: number; totalKm: number; roundTrip: boolean; source: string; note: string } | null;
  lines: CostLine[];
  total: number;
  confidence: "ESTIMATE" | "FINAL";
  disclaimer: string;
  breakdown: {
    vehicleCost: number;
    driverCost: number;
    fuelCost: number;
    toll: number;
    parking: number;
  };
}

function toCostLine(label: string, amount: number, confidence: CostLine["confidence"], source: string, note?: string): CostLine {
  return { label, amount: Math.round(amount), confidence, source, note };
}

export async function calculateTripCost(input: TripCostInput): Promise<TripCostResult> {
  const settings = await getSettings();
  const lines: CostLine[] = [];

  // ── Distance (deterministic routing) ──
  let distance: TripCostResult["distance"] = null;
  let totalKm = input.distanceKmOverride ?? 0;

  if (!totalKm || totalKm <= 0) {
    try {
      const route = await getRoute({
        fromLat: input.fromLat,
        fromLng: input.fromLng,
        toLat: input.toLat,
        toLng: input.toLng,
        roundTrip: !!input.roundTrip,
      });
      totalKm = route.totalKm;
      distance = {
        oneWayKm: route.oneWayKm,
        totalKm: route.totalKm,
        roundTrip: route.roundTrip,
        source: route.source,
        note: route.note,
      };
    } catch {
      // if routing fails, leave distance 0 and mark fuel/toll as unavailable
      distance = null;
      totalKm = 0;
    }
  } else {
    // caller supplied distance — treat as confirmed estimate source
    distance = {
      oneWayKm: input.roundTrip ? Math.round((totalKm / 2) * 10) / 10 : totalKm,
      totalKm,
      roundTrip: !!input.roundTrip,
      source: "HAVERSINE_ESTIMATE",
      note: "Distance provided by caller",
    };
  }

  const days = Math.max(1, input.durationDays ?? 1);
  const hours = input.durationHours ?? undefined;

  // ── Vehicle cost (from actual provider PricingRule) ──
  let vehicleCost = 0;
  let vehicleConfidence: CostLine["confidence"] = "PROVIDER_CONFIRMATION";
  let vehicleSource = "Provider pricing";

  if (input.vehicleId) {
    let rule = await findRuleForTarget(input.vehicleProviderId, "VEHICLE", input.vehicleId, input.vehicleCategory ?? undefined);
    // Validate targetType strictly — findRuleForTarget has permissive fallback
    if (rule && rule.targetType !== "VEHICLE") rule = null;
    const quote = quoteFromRule(rule, { days, hours, km: totalKm, ac: input.withAc ?? null });
    vehicleCost = quote.total;
    if (!rule) {
      vehicleConfidence = "PROVIDER_CONFIRMATION";
      vehicleSource = "Provider confirmation required";
    } else if (quote.confidence === "ESTIMATE") {
      vehicleConfidence = "ESTIMATE";
      vehicleSource = "Estimated from provider rate";
    } else {
      vehicleConfidence = "CONFIRMED";
    }
    // Add per-line breakdown already computed by pricingService (but we need single aggregated line for trip)
    // Keep detailed estimate: use quote.lines if we want granularity, else lump sum
    if (quote.lines.length > 0) {
      // Add detailed vehicle lines with confidence
      for (const l of quote.lines) {
        lines.push(toCostLine(`Vehicle: ${l.label}`, l.amount, vehicleConfidence, vehicleSource, l.note));
      }
      // if lines were added, vehicleCost already matches sum, don't add again
      vehicleCost = 0; // will be summed via lines (avoid double)
    } else if (vehicleCost > 0) {
      lines.push(toCostLine(`Vehicle (${days} day${days > 1 ? "s" : ""})`, vehicleCost, vehicleConfidence, vehicleSource));
      vehicleCost = 0;
    } else if (!rule) {
      lines.push(toCostLine("Vehicle cost", 0, "PROVIDER_CONFIRMATION", "Provider confirmation required", "Vehicle pricing is being set up"));
    }
  } else {
    // No specific vehicle — can't price vehicle leg
    lines.push(toCostLine("Vehicle cost", 0, "PROVIDER_CONFIRMATION", "Select a vehicle to confirm price", "Requires provider selection"));
  }

  // ── Driver cost (actual PricingRule if bundled or separate) ──
  let driverCost = 0;
  if (input.withDriver || input.driverProviderId) {
    // If driver is bundled with vehicle, prefer separate DRIVER provider book if exists,
    // but never use a VEHICLE rule as driver price — validate targetType.
    const driverOwner = input.driverProviderId || null;
    const targetId = input.driverProfileId || undefined;
    let dRule: Awaited<ReturnType<typeof findRuleForTarget>> = null;
    if (driverOwner) {
      dRule = await findRuleForTarget(driverOwner, "DRIVER", targetId);
      if (dRule && dRule.targetType !== "DRIVER") dRule = null;
    } else {
      // bundled case: vehicle owner may have a DRIVER rule — but most VEHICLE_OWNERs don't.
      // Try to find a DRIVER rule under same owner strictly.
      const cand = await findRuleForTarget(input.vehicleProviderId, "DRIVER", targetId);
      if (cand && cand.targetType === "DRIVER") dRule = cand;
      else dRule = null;
    }

    if (dRule) {
      const dQuote = quoteFromRule(dRule, { days, hours });
      driverCost = dQuote.total;
      const dConf: CostLine["confidence"] = dQuote.confidence === "ESTIMATE" ? "ESTIMATE" : "CONFIRMED";
      if (dQuote.lines.length > 0) {
        for (const l of dQuote.lines) lines.push(toCostLine(`Driver: ${l.label}`, l.amount, dConf, "Driver provider rate"));
        driverCost = 0;
      } else if (driverCost > 0) {
        lines.push(toCostLine(`Driver (${days} day${days > 1 ? "s" : ""})`, driverCost, dConf, "Driver provider rate"));
        driverCost = 0;
      }
    } else {
      // No dedicated driver pricing — show as provider confirmation but with sensible fallback estimate for transparency
      // Use regional driver estimate: ₹800-900/day if withDriver requested and no rule.
      // We mark as ESTIMATE (not CONFIRMED) so UI shows ~ Estimated.
      const fallbackDriverPerDay = 900; // regional estimate, admin can override via settings later
      const estDriver = Math.round(fallbackDriverPerDay * days);
      lines.push(toCostLine(`Driver (~${days} day${days > 1 ? "s" : ""})`, estDriver, "ESTIMATE", "Driver estimate", "Provider confirmation required — estimate based on regional rate"));
      driverCost = 0;
    }
  }

  // ── Fuel (deterministic) ──
  let fuelCost = 0;
  let fuelConfidence: CostLine["confidence"] = "ESTIMATE";
  let fuelNote = "";
  if (totalKm > 0) {
    const fuel = await calculateFuelCost({
      distanceKm: totalKm,
      category: input.vehicleCategory ?? undefined,
      fuelType: input.vehicleFuelType ?? undefined,
    });
    fuelCost = fuel.fuelCost;
    fuelConfidence = fuel.confidence === "CONFIRMED" ? "CONFIRMED" : "ESTIMATE";
    fuelNote = fuel.note;
    lines.push(toCostLine(`Fuel ~${fuel.fuelRequiredLitre}L (${fuel.fuelType}, ${fuel.mileage} km/L)`, fuelCost, fuelConfidence, "Fuel estimate", fuelNote));
    fuelCost = 0;
  } else {
    lines.push(toCostLine("Fuel", 0, "PROVIDER_CONFIRMATION", "Distance unavailable", "Fuel estimate requires distance"));
  }

  // ── Toll (estimate per km or override) ──
  let toll = 0;
  if (input.tollOverride != null) {
    toll = Math.round(input.tollOverride);
    lines.push(toCostLine("Toll", toll, "CONFIRMED", "Provided toll"));
    toll = 0;
  } else if (settings.tollConfig?.enabled && totalKm > 0) {
    const perKm = settings.tollConfig.perKmRate ?? 1.2;
    // Long trips >80km typically hit tolls; short trips 0
    const estimatedToll = totalKm > 80 ? Math.round(totalKm * perKm * 0.6) : 0; // 60% of km incur toll
    if (estimatedToll > 0) {
      lines.push(toCostLine("Toll (estimated)", estimatedToll, "ESTIMATE", "Toll estimate (per-km fallback)", "Actual toll depends on route"));
    } else {
      lines.push(toCostLine("Toll", 0, "ESTIMATE", "No toll expected for short distance"));
    }
    toll = 0;
  } else {
    lines.push(toCostLine("Toll", 0, "PROVIDER_CONFIRMATION", "Toll unavailable"));
  }

  // ── Parking ──
  let parking = 0;
  if (input.parkingOverride != null) {
    parking = Math.round(input.parkingOverride);
    lines.push(toCostLine("Parking", parking, "CONFIRMED", "Provided"));
    parking = 0;
  } else if (settings.parkingConfig?.enabled && days > 0) {
    const perDay = settings.parkingConfig.perDay ?? 100;
    const estParking = Math.round(perDay * days * 0.5); // assume parking ~50% days
    if (estParking > 0) {
      lines.push(toCostLine(`Parking (~${days} day${days > 1 ? "s" : ""})`, estParking, "ESTIMATE", "Parking estimate"));
    }
    parking = 0;
  }

  // Recompute total from lines (excluding 0-confirmation placeholders that are not added)
  const total = lines.reduce((s, l) => s + l.amount, 0) + vehicleCost + driverCost + fuelCost + toll + parking;

  const hasEstimate = lines.some((l) => l.confidence === "ESTIMATE" || l.confidence === "PROVIDER_CONFIRMATION");
  const disclaimer = hasEstimate
    ? "Some costs are estimates (fuel, toll, parking) and may change. Vehicle/driver pricing is per provider."
    : "Prices confirmed by provider.";

  return {
    distance,
    lines,
    total: Math.round(total),
    confidence: hasEstimate ? "ESTIMATE" : "FINAL",
    disclaimer,
    breakdown: {
      vehicleCost: lines.filter((l) => l.label.toLowerCase().includes("vehicle")).reduce((s, l) => s + l.amount, 0),
      driverCost: lines.filter((l) => l.label.toLowerCase().includes("driver")).reduce((s, l) => s + l.amount, 0),
      fuelCost: lines.filter((l) => l.label.toLowerCase().includes("fuel")).reduce((s, l) => s + l.amount, 0),
      toll: lines.filter((l) => l.label.toLowerCase().includes("toll")).reduce((s, l) => s + l.amount, 0),
      parking: lines.filter((l) => l.label.toLowerCase().includes("parking")).reduce((s, l) => s + l.amount, 0),
    },
  };
}

export interface BudgetComparison {
  budget: number;
  estimatedTotal: number;
  delta: number; // positive = remaining, negative = shortfall
  possible: boolean; // budget >= estimatedTotal
  confidence: "ESTIMATE" | "FINAL";
  disclaimer: string;
}

export function compareBudget(budget: number, estimatedTotal: number, confidence: "ESTIMATE" | "FINAL"): BudgetComparison {
  const delta = Math.round(budget - estimatedTotal);
  return {
    budget: Math.round(budget),
    estimatedTotal: Math.round(estimatedTotal),
    delta,
    possible: delta >= 0,
    confidence,
    disclaimer:
      confidence === "ESTIMATE"
        ? "Estimates include fuel/toll/parking; actual may vary. Confirm with provider before booking."
        : "Prices confirmed.",
  };
}
