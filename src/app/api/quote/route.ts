import { NextRequest } from "next/server";
import { findRuleForTarget, quoteFromRule } from "@/lib/services/pricingService";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

const KIND_TO_TARGET: Record<string, string> = {
  VEHICLE: "VEHICLE",
  DRIVER: "DRIVER",
  GARAGE: "GARAGE_SERVICE",
  FARM: "FARM_EQUIPMENT",
  DRONE: "DRONE_SERVICE",
};

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const kind = String(b.kind || "").toUpperCase();
  const id = String(b.id || "");
  if (!KIND_TO_TARGET[kind] || !id) return fail("kind and id are required");

  const providerId = String(b.providerId || "");
  if (!providerId) return fail("providerId is required");

  const rule = await findRuleForTarget(providerId, KIND_TO_TARGET[kind], id);
  const quote = quoteFromRule(rule, {
    days: b.days ? Number(b.days) : undefined,
    hours: b.hours ? Number(b.hours) : undefined,
    km: b.km ? Number(b.km) : undefined,
    acres: b.acres ? Number(b.acres) : undefined,
    ac: typeof b.ac === "boolean" ? b.ac : null,
  });
  return ok({ quote, rule: rule ? { model: rule.model, dailyRate: rule.dailyRate, hourlyRate: rule.hourlyRate, perKm: rule.perKm, perAcre: rule.perAcre, visitCharge: rule.visitCharge, includedKmPerDay: rule.includedKmPerDay, extraPerKm: rule.extraPerKm } : null });
}
