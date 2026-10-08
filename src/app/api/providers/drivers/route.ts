import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { parse } from "@/lib/utils";
import { startOfDay, endOfDay } from "@/lib/services/availabilityService";

export const runtime = "nodejs";

const DRIVER_DRIVE_CATEGORIES = [
  "CAR",
  "SUV",
  "VAN",
  "PICKUP",
  "TRUCK",
  "LORRY",
  "BUS",
  "AUTO",
  "BIKE",
  "TRACTOR",
  "OTHER",
] as const;

async function requireProvider() {
  const session = await getSession();
  if (!session) throw new Error("Login required");
  if (session.role !== "PROVIDER" && session.role !== "ADMIN") throw new Error("Provider access required");
  const provider = await prisma.provider.findFirst({ where: { userId: session.userId } });
  if (!provider) throw new Error("No provider profile â€” register as provider first");
  return { session, provider };
}

function normalizeCategories(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw.map((c) => String(c).toUpperCase().trim()).filter(Boolean) : [];
  const seen = new Set<string>();
  return list.filter((c) => {
    if (seen.has(c)) return false;
    seen.add(c);
    return true;
  });
}

export async function GET() {
  try {
    const { provider } = await requireProvider();
    const drivers = await prisma.driver.findMany({
      where: { providerId: provider.id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: { availabilities: { where: { endAt: { gte: startOfDay(new Date()) } }, orderBy: { startAt: "asc" } } },
    });

    const rules = await prisma.pricingRule.findMany({ where: { ownerProviderId: provider.id, active: true } });
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    // Batch booking counts for all drivers (was 1 query per driver -> 1 total)
    const ACTIVE_STATUSES = ["REQUESTED", "PENDING_PROVIDER", "ACCEPTED", "CONFIRMED", "EN_ROUTE", "IN_PROGRESS"];
    const bookingCounts = await prisma.booking.groupBy({
      by: ["listingId"],
      where: { listingKind: "DRIVER", listingId: { in: drivers.map((d) => d.id) }, status: { in: ACTIVE_STATUSES } },
      _count: { _all: true },
    });
    const activeCountById = new Map(bookingCounts.map((r) => [r.listingId, r._count._all]));

    const enriched = drivers.map((dr) => {
      const todayBlock = dr.availabilities.find((a) => new Date(a.startAt) <= todayEnd && new Date(a.endAt) >= todayStart);
      const upcomingBlocks = dr.availabilities.filter((a) => new Date(a.startAt) > todayEnd).slice(0, 3);
      const activeBookings = activeCountById.get(dr.id) || 0;
      const rule =
        rules.find((r) => r.targetId === dr.id) ||
        rules.find((r) => r.targetType === "DRIVER") ||
        null;
      return {
        ...dr,
        categories: parse(dr.categoriesJson, []) as string[],
        languages: parse(dr.languagesJson, []) as string[],
        isUnavailableToday: !!todayBlock,
        todayBlock: todayBlock || null,
        upcomingBlocks,
        activeBookings,
        pricing: rule
          ? {
              model: rule.model,
              dailyRate: rule.dailyRate,
              hourlyRate: rule.hourlyRate,
              perKm: rule.perKm,
              deposit: rule.deposit,
            }
          : null,
      };
    });

    return ok({ drivers: enriched, providerId: provider.id });
  } catch (e: any) {
    const m = e.message || "Failed to fetch drivers";
    if (m.includes("Login")) return fail(m, 401);
    if (m.includes("Provider")) return fail(m, 403);
    console.error("GET drivers");
    return fail("Failed to load drivers", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { provider } = await requireProvider();
    const b = await req.json().catch(() => ({}));

    const name = String(b.name || "").trim();
    if (!name) return fail("Driver name is required");
    if (name.length > 80) return fail("Name too long");

    const categories = normalizeCategories(b.categories ?? b.driveCategories ?? b.vehicleTypes);
    const known = new Set<string>(DRIVER_DRIVE_CATEGORIES);
    for (const c of categories) {
      if (!known.has(c)) return fail(`Unknown vehicle type "${c}". Allowed: ${DRIVER_DRIVE_CATEGORIES.join(", ")}`);
    }
    if (categories.length === 0) return fail("Select what this driver drives (e.g. CAR, LORRY, TRUCK)");

    const experienceYears = b.experienceYears != null ? Number(b.experienceYears) : 0;
    if (isNaN(experienceYears) || experienceYears < 0 || experienceYears > 60) return fail("Invalid experience years");

    const licenseType = b.licenseType ? String(b.licenseType).toUpperCase() : "LMV";
    const allowedLicenses = ["LMV", "LMV_TR", "HMV", "HPMV", "AUTO_RICKSHAW"];
    if (!allowedLicenses.includes(licenseType)) return fail("Invalid license type");

    const phone = b.phone ? String(b.phone).trim().slice(0, 20) : null;
    const languages = Array.isArray(b.languages)
      ? b.languages.slice(0, 8).map((l: unknown) => String(l).trim()).filter(Boolean)
      : [];
    const note = b.note ? String(b.note).trim().slice(0, 200) : null;

    const driver = await prisma.driver.create({
      data: {
        providerId: provider.id,
        name,
        phone,
        experienceYears,
        licenseType,
        languagesJson: JSON.stringify(languages),
        categoriesJson: JSON.stringify(categories),
        status: "ACTIVE",
      },
    });

    // Pricing rule if provided (optional â€” falls back to provider-level DRIVER rule)
    const pricing = b.pricing || {};
    const dailyRate = pricing.dailyRate != null ? Number(pricing.dailyRate) : b.dailyRate != null ? Number(b.dailyRate) : null;
    const hourlyRate = pricing.hourlyRate != null ? Number(pricing.hourlyRate) : null;
    if (dailyRate != null && (dailyRate < 100 || dailyRate > 100000)) return fail("Daily rate must be between â‚¹100 and â‚¹100,000");
    if (hourlyRate != null && (hourlyRate < 50 || hourlyRate > 20000)) return fail("Hourly rate invalid");
    if (dailyRate !== null || hourlyRate !== null) {
      await prisma.pricingRule.create({
        data: {
          ownerProviderId: provider.id,
          targetType: "DRIVER",
          targetId: driver.id,
          category: "DRIVER",
          model: hourlyRate ? "HOURLY" : "DAILY",
          dailyRate,
          hourlyRate,
          deposit: pricing.deposit != null ? Number(pricing.deposit) : null,
          active: true,
        },
      });
    }

    return ok({ driver: { ...driver, categories }, message: "Driver added to roster" }, { status: 201 });
  } catch (e: any) {
    console.error("POST driver");
    return fail(e?.message || "Could not add driver", 400);
  }
}
export const dynamic = "force-dynamic";