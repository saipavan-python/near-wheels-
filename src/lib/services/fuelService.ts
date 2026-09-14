import { getSettings } from "../config";

/**
 * Deterministic fuel cost calculation — NEVER let LLM invent fuel prices.
 * Fuel price comes from PlatformSettings.fuelPrices (admin-configurable, region-aware).
 * Mileage comes from PlatformSettings.mileageKmPerLitre (per category + fuelType).
 *
 * Formula: fuelRequired = distanceKm / mileage; cost = fuelRequired * pricePerLitre
 */

export type FuelType = "PETROL" | "DIESEL" | "CNG" | "ELECTRIC";

export interface FuelCostInput {
  distanceKm: number; // one-way or round-trip total distance
  category?: string | null; // CAR, SUV, AUTO etc
  fuelType?: string | null; // PETROL, DIESEL, CNG, ELECTRIC
  mileageOverride?: number | null; // if provider specifies exact mileage
}

export interface FuelCostResult {
  distanceKm: number;
  mileage: number; // km/l used
  fuelRequiredLitre: number;
  fuelType: FuelType;
  pricePerLitre: number;
  fuelCost: number; // INR rounded
  confidence: "CONFIRMED" | "ESTIMATE";
  note: string; // explain source for UI disclaimer
}

const FUEL_TYPE_ALIASES: Record<string, FuelType> = {
  PETROL: "PETROL",
  DIESEL: "DIESEL",
  CNG: "CNG",
  ELECTRIC: "ELECTRIC",
  EV: "ELECTRIC",
};

function normalizeFuelType(raw?: string | null): FuelType {
  if (!raw) return "PETROL";
  const k = raw.toUpperCase().trim();
  return FUEL_TYPE_ALIASES[k] || "PETROL";
}

export async function calculateFuelCost(input: FuelCostInput): Promise<FuelCostResult> {
  const settings = await getSettings();
  const fuelType = normalizeFuelType(input.fuelType);

  const pricePerLitre =
    (settings.fuelPrices as unknown as Record<string, number>)[fuelType] ?? settings.fuelPrices.PETROL ?? 107.5;

  let mileage: number | null = null;
  if (input.mileageOverride && input.mileageOverride > 0) mileage = input.mileageOverride;
  else if (input.category) {
    mileage = settings.mileageKmPerLitre[input.category.toUpperCase()] ?? null;
  }
  if (!mileage || mileage <= 0) mileage = 15; // fallback for unknown category

  const distanceKm = Math.max(0, Math.round(input.distanceKm * 10) / 10);
  const fuelRequiredLitre = mileage > 0 ? distanceKm / mileage : 0;
  const fuelCost = Math.round(fuelRequiredLitre * pricePerLitre);

  const region = settings.fuelPrices.region || "regional estimate";
  const isEstimate = !input.fuelType || !input.category;

  return {
    distanceKm,
    mileage,
    fuelRequiredLitre: Math.round(fuelRequiredLitre * 100) / 100,
    fuelType,
    pricePerLitre,
    fuelCost,
    confidence: isEstimate ? "ESTIMATE" : "CONFIRMED",
    note: `Fuel @ ₹${pricePerLitre}/L (${fuelType}, ${mileage} km/L) · ${region}${isEstimate ? " — estimate, may vary" : ""}`,
  };
}

export async function getFuelPrice(fuelType: FuelType): Promise<number> {
  const s = await getSettings();
  return (s.fuelPrices as unknown as Record<string, number>)[fuelType] ?? s.fuelPrices.PETROL;
}

/** For admin UI — update fuel price safely (keeps other settings). */
export async function getFuelPriceTable(): Promise<Record<string, number> & { region?: string; updatedAt?: string }> {
  const s = await getSettings();
  return { ...s.fuelPrices } as unknown as Record<string, number> & { region?: string; updatedAt?: string };
}
