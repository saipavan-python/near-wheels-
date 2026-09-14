import { prisma } from "../db";
import type { PricingRule } from "@prisma/client";
import type { PriceQuote } from "../types";
import { inr } from "../utils";

export interface QuoteParams {
  days?: number;
  hours?: number;
  km?: number;
  acres?: number;
  ac?: boolean | null;
}

function r(n: number): number {
  return Math.round(n);
}

/**
 * Backend-controlled price engine (spec §29–31).
 * The AI and the UI may NEVER fabricate prices; everything comes from here.
 * Each provider pricing model is explicit to avoid double charging.
 */
export function quoteFromRule(
  rule: PricingRule | null,
  params: QuoteParams
): PriceQuote {
  if (!rule) {
    return {
      currency: "INR",
      lines: [],
      total: 0,
      confidence: "ESTIMATE",
      disclaimer: "Pricing for this listing is being set up. Final price will be shown after the provider confirms.",
    };
  }

  const lines: { label: string; amount: number; note?: string }[] = [];
  const days = Math.max(1, params.days ?? (params.hours ? 0 : 1));
  const hours = params.hours ?? 0;
  const km = params.km ?? 0;
  const acres = params.acres ?? 0;

  // Customer can request any duration (days/hours/km) regardless of provider's primary model — show the requested mode with fallback estimate
  const requestedMode = hours > 0 ? "HOURLY" : km > 0 ? "PER_KM" : "DAILY";

  switch (rule.model) {
    case "DAILY":
    case "PER_DAY":
    case "MIXED": {
      if (requestedMode === "HOURLY" && hours > 0) {
        if (rule.hourlyRate) {
          lines.push({ label: `Hourly rate × ${hours} h`, amount: r(rule.hourlyRate * hours) });
        } else if (rule.dailyRate) {
          // fallback: estimate hourly as dailyRate / 8
          const estHourly = Math.round(rule.dailyRate / 8);
          lines.push({ label: `Hourly rate × ${hours} h (estimated from daily)`, amount: r(estHourly * hours), note: `Estimated from ₹${rule.dailyRate}/day` });
        }
      } else if (requestedMode === "PER_KM" && km > 0) {
        if (rule.perKm) {
          lines.push({ label: `Distance × ${r(km)} km @ ${inr(rule.perKm)}/km`, amount: r(rule.perKm * km) });
        } else if (rule.dailyRate) {
          // fallback: estimate per km as dailyRate / 100
          const estPerKm = Math.round(rule.dailyRate / 100);
          lines.push({ label: `Distance × ${r(km)} km @ ${inr(estPerKm)}/km (estimated)`, amount: r(estPerKm * km), note: `Estimated from daily rate` });
        }
      } else {
        if (days > 0 && rule.dailyRate) {
          lines.push({ label: `Daily rate × ${days} day${days > 1 ? "s" : ""}`, amount: r(rule.dailyRate * days) });
        }
        if (hours > 0 && rule.hourlyRate) {
          lines.push({ label: `Hourly rate × ${hours} h`, amount: r(rule.hourlyRate * hours) });
        }
      }
      if (params.ac === true && rule.acSurchargeDay && days > 0) {
        lines.push({ label: `AC surcharge × ${days} day${days > 1 ? "s" : ""}`, amount: r(rule.acSurchargeDay * days) });
      }
      if (km > 0 && rule.includedKmPerDay != null && rule.extraPerKm) {
        const included = (rule.includedKmPerDay || 0) * Math.max(1, days);
        if (km > included) {
          lines.push({
            label: `Extra distance (${r(km - included)} km beyond ${included} free km)`,
            amount: r((km - included) * rule.extraPerKm),
          });
        }
      }
      if (rule.driverAllowanceDay && days > 0 && rule.note?.includes("driver")) {
        lines.push({ label: `Driver allowance × ${days}`, amount: r(rule.driverAllowanceDay * days) });
      }
      break;
    }
    case "HOURLY": {
      const h = hours > 0 ? hours : days * 24;
      if (requestedMode === "HOURLY" && hours > 0 && rule.hourlyRate) {
        lines.push({ label: `Hourly rate × ${h} h`, amount: r(rule.hourlyRate * h) });
      } else if (requestedMode === "DAILY" && rule.hourlyRate) {
        // fallback: estimate daily from hourly * 8
        const estDaily = rule.hourlyRate * 8;
        lines.push({ label: `Daily rate × ${days} day${days > 1 ? "s" : ""} (estimated from hourly)`, amount: r(estDaily * days), note: `Estimated from ₹${rule.hourlyRate}/hr` });
      } else if (requestedMode === "PER_KM" && rule.hourlyRate) {
        const estPerKm = Math.round((rule.hourlyRate * 8) / 100);
        lines.push({ label: `Distance × ${r(km)} km @ ${inr(estPerKm)}/km (estimated)`, amount: r(estPerKm * km), note: `Estimated from hourly rate` });
      } else if (rule.hourlyRate) {
        lines.push({ label: `Hourly rate × ${h} h`, amount: r(rule.hourlyRate * h) });
      }
      break;
    }
    case "PER_KM": {
      if (requestedMode === "PER_KM" && km > 0 && rule.perKm) {
        lines.push({ label: `Distance × ${r(km)} km @ ${inr(rule.perKm)}/km`, amount: r(rule.perKm * km) });
      } else if (requestedMode === "DAILY" && rule.perKm) {
        // fallback: estimate daily as perKm * 100
        const estDaily = rule.perKm * 100;
        lines.push({ label: `Daily rate × ${days} day${days > 1 ? "s" : ""} (estimated from per km)`, amount: r(estDaily * days), note: `Estimated from ₹${rule.perKm}/km` });
      } else if (requestedMode === "HOURLY" && rule.perKm) {
        const estHourly = Math.round((rule.perKm * 100) / 8);
        lines.push({ label: `Hourly rate × ${hours} h (estimated)`, amount: r(estHourly * hours), note: `Estimated from per km rate` });
      } else if (rule.perKm && km > 0) {
        lines.push({ label: `Distance × ${r(km)} km @ ${inr(rule.perKm)}/km`, amount: r(rule.perKm * km) });
      }
      break;
    }
    case "PER_TRIP": {
      if (rule.perTrip) lines.push({ label: "Trip charge", amount: r(rule.perTrip) });
      if (km > 0 && rule.perKm) lines.push({ label: `Extra distance × ${r(km)} km`, amount: r(rule.perKm * km) });
      break;
    }
    case "PER_ACRE": {
      const billable = Math.max(acres, rule.minAcres || 0);
      if (rule.perAcre && acres > 0) {
        lines.push({ label: `${acres} acre(s) @ ${inr(rule.perAcre)}/acre`, amount: r(rule.perAcre * billable) });
      }
      break;
    }
    case "PER_VISIT": {
      if (rule.visitCharge) lines.push({ label: "Visit / service charge", amount: r(rule.visitCharge) });
      break;
    }
  }

  if (rule.travelCharge) lines.push({ label: "Travel charge", amount: r(rule.travelCharge) });
  if (rule.waitingChargePerHr && params.hours && rule.model !== "HOURLY") {
    // waiting charges only apply when explicitly quoted with waiting time — not added by default
  }
  if (lines.length === 0 && rule.minCharge) {
    lines.push({ label: "Minimum charge", amount: r(rule.minCharge) });
  }

  let total = lines.reduce((a, l) => a + l.amount, 0);
  if (total < (rule.minCharge || 0)) {
    total = r(rule.minCharge!);
    lines.push({ label: "Adjusted to minimum charge", amount: 0, note: `Minimum applies` });
  }

  const isEstimate =
    rule.model === "PER_KM" ||
    rule.model === "PER_TRIP" ||
    (km > 0 && !params.km) ||
    rule.model === "MIXED";

  return {
    currency: "INR",
    lines,
    total,
    confidence: "ESTIMATE",
    disclaimer:
      isEstimate && rule.active
        ? "Estimated price — final amount may change based on actual distance/additional services."
        : undefined,
  };
}

export async function findRuleForTarget(
  ownerProviderId: string,
  targetType: string,
  targetId?: string,
  category?: string
): Promise<PricingRule | null> {
  const rules = await prisma.pricingRule.findMany({
    where: { ownerProviderId, active: true },
  });
  if (targetId) {
    const exact = rules.find((x) => x.targetType === targetType && x.targetId === targetId);
    if (exact) return exact;
  }
  if (category) {
    const cat = rules.find((x) => x.targetType === targetType && x.category === category);
    if (cat) return cat;
  }
  return rules.find((x) => x.targetType === targetType && !x.targetId) || rules[0] || null;
}

/** Smallest sensible "from" price used on search cards. Never shown as final. */
export function minVisiblePrice(rule: PricingRule | null): number | null {
  if (!rule) return null;
  const candidates = [
    rule.dailyRate ? rule.dailyRate : null,
    rule.hourlyRate ? rule.hourlyRate * 4 : null, // ~half-day equivalent
    rule.perTrip,
    rule.visitCharge,
    rule.perAcre ? rule.perAcre * (rule.minAcres || 1) : null,
    rule.perKm ? rule.perKm * 10 : null,
  ].filter((n): n is number => n != null);
  if (!candidates.length) return rule.minCharge ?? null;
  return Math.min(...candidates);
}
