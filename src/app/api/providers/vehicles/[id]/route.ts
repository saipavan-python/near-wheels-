import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { parse } from "@/lib/utils";

export const runtime = "nodejs";

async function requireProvider() {
  const session = getSession();
  if (!session) throw new Error("Login required");
  if (session.role !== "PROVIDER" && session.role !== "ADMIN") throw new Error("Provider access required");
  const provider = await prisma.provider.findFirst({ where: { userId: session.userId } });
  if (!provider) throw new Error("No provider profile");
  return { session, provider };
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const { provider } = await requireProvider();
    const v = await prisma.vehicle.findUnique({ where: { id: ctx.params.id }, include: { availabilities: true } });
    if (!v) return fail("Vehicle not found", 404);
    if (v.providerId !== provider.id && getSession()?.role !== "ADMIN") return fail("Not your vehicle", 403);
    const rule = await prisma.pricingRule.findFirst({ where: { ownerProviderId: v.providerId, targetId: v.id } }) || await prisma.pricingRule.findFirst({ where: { ownerProviderId: v.providerId, targetType: "VEHICLE" } });
    return ok({ vehicle: { ...v, images: parse(v.imagesJson, []) }, pricing: rule });
  } catch (e: any) {
    const m = e.message || "Failed";
    if (m.includes("Login")) return fail(m, 401);
    if (m.includes("Provider") || m.includes("Not your")) return fail(m, 403);
    return fail(m, 400);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const { provider } = await requireProvider();
    const v = await prisma.vehicle.findUnique({ where: { id: ctx.params.id } });
    if (!v) return fail("Vehicle not found", 404);
    if (v.providerId !== provider.id && getSession()?.role !== "ADMIN") return fail("Not your vehicle", 403);
    const b = await req.json().catch(() => ({}));

    const data: any = {};
    const fields = ["category","make","model","variant","title","seats","transmission","fuelType","ac","selfDriveAllowed","withDriverAllowed","loadCapacityTons","status","year","color","registrationNumber","imageUrl","pickupLat","pickupLng","pickupAddress"] as const;
    for (const f of fields) {
      if (f in b) {
        let val = b[f];
        if (f === "seats" || f === "year" || f === "loadCapacityTons" || f === "pickupLat" || f === "pickupLng") val = val != null ? Number(val) : null;
        if (f === "ac" && typeof val === "string") val = val === "true" ? true : val === "false" ? false : null;
        if (f === "category" || f === "transmission" || f === "fuelType" || f === "status") val = val ? String(val).toUpperCase() : val;
        if (typeof val === "string") val = val.trim() || null;
        data[f] = val;
      }
    }
    if (b.images && Array.isArray(b.images)) data.imagesJson = JSON.stringify(b.images.slice(0,10).map(String));
    if (b.imageUrls && Array.isArray(b.imageUrls)) data.imagesJson = JSON.stringify(b.imageUrls.slice(0,10).map(String));
    // Validate status transition
    if (data.status && !["ACTIVE","INACTIVE","MAINTENANCE","SUSPENDED","PENDING_VERIFICATION"].includes(data.status)) delete data.status;

    data.updatedAt = new Date();

    const updated = await prisma.vehicle.update({ where: { id: ctx.params.id }, data });

    // Update pricing if provided
    if (b.pricing) {
      const p = b.pricing;
      const rule = await prisma.pricingRule.findFirst({ where: { ownerProviderId: provider.id, targetId: v.id } });
      const payload: any = {};
      for (const k of ["dailyRate","hourlyRate","perKm","perTrip","perAcre","deposit","visitCharge","minCharge","includedKmPerDay","extraPerKm","model"] as const) {
        if (k in p) payload[k] = p[k] != null ? (k === "model" ? String(p[k]).toUpperCase() : Number(p[k])) : null;
      }
      if (rule) {
        await prisma.pricingRule.update({ where: { id: rule.id }, data: payload });
      } else if (Object.keys(payload).length) {
        await prisma.pricingRule.create({ data: { ownerProviderId: provider.id, targetType: "VEHICLE", targetId: v.id, category: updated.category, ...payload, model: payload.model || "DAILY", active: true } });
      }
    }

    return ok({ vehicle: updated });
  } catch (e: any) {
    console.error("PATCH vehicle", e);
    return fail(e?.message || "Update failed", 400);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const { provider } = await requireProvider();
    const v = await prisma.vehicle.findUnique({ where: { id: ctx.params.id } });
    if (!v) return fail("Vehicle not found", 404);
    if (v.providerId !== provider.id && getSession()?.role !== "ADMIN") return fail("Not your vehicle", 403);

    // Soft delete: set INACTIVE rather than hard delete to preserve booking history
    const updated = await prisma.vehicle.update({ where: { id: ctx.params.id }, data: { status: "INACTIVE" } });
    return ok({ vehicle: updated, message: "Vehicle deactivated" });
  } catch (e: any) {
    return fail(e?.message || "Delete failed", 400);
  }
}
