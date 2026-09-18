import { prisma } from "./db";
import type { SortPriority } from "./types";

/**
 * FREE_MODE (env `FREE_MODE`, default: ON)
 * During the launch period Near Wheels is free — customers book and the
 * booking is confirmed automatically; no advance/payment is collected and no
 * commission is taken. Flip to "off" when payments & monetization go live.
 */
export const FREE_MODE =
  (process.env.FREE_MODE ?? "on").toLowerCase() !== "off" &&
  (process.env.FREE_MODE ?? "on").toLowerCase() !== "false";

/**
 * Dynamic platform configuration (spec §69).
 * Stored in AppSetting("platform") as JSON; admins can change at runtime
 * without redeploying. Falls back to defaults when missing/corrupt.
 */
export interface PlatformSettings {
  immediateSearchRadiusKm: number;
  fallbackRadiusKm: number;
  maxSearchRadiusKm: number;
  rankingWeights: {
    needMatch: number; // %
    availability: number;
    distance: number;
    price: number;
    rating: number;
    verification: number;
  };
  emergencyWeights: {
    needMatch: number;
    availability: number;
    distance: number;
    price: number;
    rating: number;
    verification: number;
  };
  commissionRates: { FREE: number; PRO: number; BUSINESS: number };
  minProviderRating: number;
  providerResponseTimeoutSec: number;
  supportedCategories: string[];
  pricingDisplayRules: { showEstimatesAsEstimate: boolean };
  demoAutoAcceptProviders: boolean;
  // ── Trip cost engine (Phase 1: fuel / toll / parking / mileage) ──
  fuelPrices: {
    PETROL: number; // INR per litre
    DIESEL: number;
    CNG: number;
    ELECTRIC: number; // per kWh equivalent (for estimation)
    updatedAt?: string; // ISO
    region?: string;
  };
  mileageKmPerLitre: Record<string, number>; // category -> km/l
  tollConfig: {
    perKmRate: number; // INR per km fallback when no provider toll data
    enabled: boolean;
  };
  parkingConfig: {
    perDay: number; // INR estimate
    enabled: boolean;
  };
  // ── Cancellation policy ──
  cancellationWindowHours: number; // free if cancelled more than this many hours before start
  cancellationFeePercent: number; // % of booking total charged after the window
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  immediateSearchRadiusKm: 15,
  fallbackRadiusKm: 30,
  maxSearchRadiusKm: 60,
  rankingWeights: {
    needMatch: 35,
    availability: 20,
    distance: 15,
    price: 15,
    rating: 10,
    verification: 5,
  },
  emergencyWeights: {
    needMatch: 25,
    availability: 30,
    distance: 20,
    price: 5,
    rating: 12,
    verification: 8,
  },
  commissionRates: { FREE: 0, PRO: 0, BUSINESS: 0 },
  minProviderRating: 3.0,
  providerResponseTimeoutSec: 60,
  supportedCategories: [
    "CAR",
    "AUTO",
    "BIKE",
    "SCOOTER",
    "SUV",
    "VAN",
    "PICKUP",
    "TRUCK",
    "BUS",
    "TRACTOR",
  ],
  pricingDisplayRules: { showEstimatesAsEstimate: true },
  demoAutoAcceptProviders: true,
  fuelPrices: {
    PETROL: 107.5,
    DIESEL: 97.5,
    CNG: 78.0,
    ELECTRIC: 8.5,
    updatedAt: new Date().toISOString(),
    region: "Telangana (estimate)",
  },
  mileageKmPerLitre: {
    CAR: 15,
    SUV: 12,
    VAN: 12,
    PICKUP: 13,
    TRUCK: 6,
    BUS: 5,
    AUTO: 25,
    BIKE: 45,
    SCOOTER: 45,
    TRACTOR: 8,
  },
  tollConfig: { perKmRate: 1.2, enabled: true },
  parkingConfig: { perDay: 100, enabled: true },
  cancellationWindowHours: 2,
  cancellationFeePercent: 0.1,
};

let cache: { value: PlatformSettings; at: number } | null = null;
const TTL_MS = 15_000;

export async function getSettings(): Promise<PlatformSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    const row = await prisma.appSetting.findUnique({ where: { id: "platform" } });
    let value = DEFAULT_SETTINGS;
    if (row) {
      const parsed = JSON.parse(row.value);
      value = deepMerge(DEFAULT_SETTINGS, parsed);
    }
    cache = { value, at: Date.now() };
    return value;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(patch: Partial<PlatformSettings>): Promise<PlatformSettings> {
  const current = await getSettings();
  const value = deepMerge(current, patch);
  await prisma.appSetting.upsert({
    where: { id: "platform" },
    update: { value: JSON.stringify(value) },
    create: { id: "platform", value: JSON.stringify(value) },
  });
  cache = { value, at: Date.now() };
  return value;
}

export function clearSettingsCache() {
  cache = null;
}

/** Weights adjusted for the active intent + customer's stated priority (§27/28). */
export function weightsForIntent(
  base: PlatformSettings,
  intent: string,
  sortBy?: SortPriority
): Record<string, number> {
  let w = { ...base.rankingWeights } as Record<string, number>;
  if (intent === "EMERGENCY" || intent === "TOWING" || intent.startsWith("ROADSIDE")) {
    w = { ...base.emergencyWeights } as Record<string, number>;
  }
  switch (sortBy) {
    case "CHEAPEST":
      w.price += 25;
      w.distance -= Math.min(10, w.distance);
      w.rating -= Math.min(5, w.rating);
      break;
    case "NEAREST":
      w.distance += 25;
      w.price -= Math.min(10, w.price);
      break;
    case "BEST_RATED":
      w.rating += 25;
      w.price -= Math.min(10, w.price);
      break;
    case "FASTEST":
      w.availability += 15;
      w.distance += 10;
      break;
    default:
      break;
  }
  return normalize(w);
}

function normalize(w: Record<string, number>): Record<string, number> {
  const entries = Object.entries(w).map(([k, v]) => [k, Math.max(0, v)] as [string, number]);
  const sum = entries.reduce((a, [, v]) => a + v, 0) || 1;
  return Object.fromEntries(entries.map(([k, v]) => [k, (v / sum) * 100]));
}

function deepMerge<T>(base: T, patch: any): T {
  if (patch === undefined || patch === null) return base;
  if (typeof base !== "object" || Array.isArray(base)) return patch as T;
  const out: any = { ...base };
  for (const k of Object.keys(patch)) {
    out[k] = k in (base as any) ? deepMerge((base as any)[k], patch[k]) : patch[k];
  }
  return out;
}
