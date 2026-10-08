import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { parse } from "@/lib/utils";

export const runtime = "nodejs";

const DRIVER_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;
const DRIVER_LICENSES = ["LMV", "LMV_TR", "HMV", "HPMV", "AUTO_RICKSHAW"] as const; // used by PATCH below

async function requireProvider() {
  const session = await getSession();
  if (!session) throw new Error("Login required");
  if (session.role !== "PROVIDER" && session.role !== "ADMIN") throw new Error("Provider access required");
  const provider = await prisma.provider.findFirst({ where: { userId: session.userId } });
  if (!provider) throw new Error("No provider profile");
  return { session, provider };
}

async function ownDriver(driverId: string, providerId: string, role: string) {
  const dr = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!dr) return null;
  if (dr.providerId !== providerId && role !== "ADMIN") return undefined;
  return dr;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{  id: string  }> }) {
  try {
    const { provider } = await requireProvider();
    const dr = await ownDriver((await ctx.params).id, provider.id, (await getSession())?.role || "");
    if (dr === null) return fail("Driver not found", 404);
    if (dr === undefined) return fail("Not your driver", 403);

    const rule = await prisma.pricingRule.findFirst({ where: { ownerProviderId: provider.id, targetId: dr.id } })
      || await prisma.pricingRule.findFirst({ where: { ownerProviderId: provider.id, targetType: "DRIVER" } });
    return ok({
      driver: {
        ...dr,
        categories: parse(dr.categoriesJson, []) as string[],
        languages: parse(dr.languagesJson, []) as string[],
      },
      pricing: rule,
    });
  } catch (e: any) {
    const m = e.message || "Failed";
    if (m.includes("Login")) return fail(m, 401);
    if (m.includes("Provider") || m.includes("Not your")) return fail(m, 403);
    return fail(m, 400);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{  id: string  }> }) {
  try {
    const { provider } = await requireProvider();
    const dr = await ownDriver((await ctx.params).id, provider.id, (await getSession())?.role || "");
    if (dr === null) return fail("Driver not found", 404);
    if (dr === undefined) return fail("Not your driver", 403);

    const b = await req.json().catch(() => ({}));
    const data: any = {};
    const DRIVER_LICENSES = ["LMV", "LMV_TR", "HMV", "HPMV", "AUTO_RICKSHAW"] as const;
    const DRIVER_DRIVE_CATEGORIES = ["CAR", "SUV", "VAN", "PICKUP", "TRUCK", "LORRY", "BUS", "AUTO", "BIKE", "TRACTOR", "OTHER"] as const;

    if ("name" in b) {
      const name = String(b.name || "").trim();
      if (!name || name.length > 80) return fail("Valid name required");
      data.name = name;
    }
    if ("phone" in b) data.phone = b.phone ? String(b.phone).trim().slice(0, 20) : null;
    if ("photoUrl" in b) data.photoUrl = b.photoUrl ? String(b.photoUrl).trim() : null;
    if ("experienceYears" in b) {
      const v = Number(b.experienceYears);
      if (isNaN(v) || v < 0 || v > 60) return fail("Invalid experience years");
      data.experienceYears = v;
    }
    if ("languages" in b) {
      const langs = Array.isArray(b.languages) ? b.languages.slice(0, 8).map((l: unknown) => String(l).trim()).filter(Boolean) : [];
      data.languagesJson = JSON.stringify(langs);
    }
    if ("categories" in b || "vehicleTypes" in b || "driveCategories" in b) {
      const raw = b.categories ?? b.vehicleTypes ?? b.driveCategories;
      const list = Array.isArray(raw) ? raw.map((c: unknown) => String(c).toUpperCase().trim()).filter(Boolean) : [];
      const known = new Set<string>(DRIVER_DRIVE_CATEGORIES);
      for (const c of list) if (!known.has(c)) return fail(`Unknown vehicle type "${c}"`);
      if (!list.length) return fail("Select what this driver drives");
      data.categoriesJson = JSON.stringify([...new Set(list)]);
    }
    if ("licenseType" in b) {
      const v = String(b.licenseType || "").toUpperCase();
      if (!DRIVER_LICENSES.includes(v as any)) return fail("Invalid license type");
      data.licenseType = v;
    }
    if ("licenseNumber" in b) data.licenseNumber = b.licenseNumber ? String(b.licenseNumber).trim().toUpperCase() : null;
    if ("status" in b) {
      const v = String(b.status || "").toUpperCase();
      if (!DRIVER_STATUSES.includes(v as any)) return fail("Invalid status");
      data.status = v;
    }

    data.updatedAt = new Date();
    const updated = await prisma.driver.update({ where: { id: (await ctx.params).id }, data });

    if (b.pricing) {
      const p = b.pricing;
      const rule = await prisma.pricingRule.findFirst({ where: { ownerProviderId: provider.id, targetId: dr.id } });
      const payload: any = {};
      for (const k of ["dailyRate", "hourlyRate", "perKm", "deposit", "model"] as const) {
        if (k in p) payload[k] = p[k] != null ? (k === "model" ? String(p[k]).toUpperCase() : Number(p[k])) : null;
      }
      if (rule) {
        await prisma.pricingRule.update({ where: { id: rule.id }, data: payload });
      } else if (Object.keys(payload).length) {
        await prisma.pricingRule.create({
          data: { ownerProviderId: provider.id, targetType: "DRIVER", targetId: dr.id, category: "DRIVER", ...payload, model: payload.model || "DAILY", active: true },
        });
      }
    }

    return ok({ driver: { ...updated, categories: parse(updated.categoriesJson, []) } });
  } catch (e: any) {
    console.error("PATCH driver");
    return fail(e?.message || "Update failed", 400);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{  id: string  }> }) {
  try {
    const { provider } = await requireProvider();
    const dr = await ownDriver((await ctx.params).id, provider.id, (await getSession())?.role || "");
    if (dr === null) return fail("Driver not found", 404);
    if (dr === undefined) return fail("Not your driver", 403);

    // Soft delete: INACTIVE preserves booking history
    const updated = await prisma.driver.update({ where: { id: (await ctx.params).id }, data: { status: "INACTIVE" } });
    await prisma.driverAvailability.deleteMany({ where: { driverId: dr.id } });
    return ok({ driver: updated, message: "Driver deactivated" });
  } catch (e: any) {
    return fail(e?.message || "Delete failed", 400);
  }
}