import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

async function requireProvider() {
  const session = getSession();
  if (!session) throw new Error("Login required");
  if (session.role !== "PROVIDER" && session.role !== "ADMIN") throw new Error("Provider access required");
  const provider = await prisma.provider.findFirst({ where: { userId: session.userId } });
  if (!provider) throw new Error("No provider profile");
  return { session, provider };
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string; availabilityId: string } }) {
  try {
    const { provider } = await requireProvider();
    const dr = await prisma.driver.findUnique({ where: { id: ctx.params.id } });
    if (!dr) return fail("Driver not found", 404);
    if (dr.providerId !== provider.id && getSession()?.role !== "ADMIN") return fail("Not your driver", 403);

    const a = await prisma.driverAvailability.findUnique({ where: { id: ctx.params.availabilityId } });
    if (!a || a.driverId !== dr.id) return fail("Availability not found", 404);

    const b = await req.json().catch(() => ({}));
    const data: any = {};
    for (const key of ["note"] as const) {
      if (key in b) data[key] = b[key] ? String(b[key]).slice(0, 300) : null;
    }
    if ("status" in b) data.status = String(b.status).toUpperCase();

    data.updatedAt = new Date();
    const updated = await prisma.driverAvailability.update({ where: { id: a.id }, data });
    return ok({ availability: updated });
  } catch (e: any) {
    const m = e.message || "Update failed";
    if (m.includes("Login")) return fail(m, 401);
    if (m.includes("Provider") || m.includes("Not your")) return fail(m, 403);
    return fail(m, 400);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string; availabilityId: string } }) {
  try {
    const { provider } = await requireProvider();
    const dr = await prisma.driver.findUnique({ where: { id: ctx.params.id } });
    if (!dr) return fail("Driver not found", 404);
    if (dr.providerId !== provider.id && getSession()?.role !== "ADMIN") return fail("Not your driver", 403);

    const a = await prisma.driverAvailability.findUnique({ where: { id: ctx.params.availabilityId } });
    if (!a || a.driverId !== dr.id) return fail("Availability not found", 404);

    await prisma.driverAvailability.delete({ where: { id: a.id } });
    return ok({ deleted: true });
  } catch (e: any) {
    const m = e.message || "Delete failed";
    if (m.includes("Login")) return fail(m, 401);
    if (m.includes("Provider") || m.includes("Not your")) return fail(m, 403);
    return fail(m, 400);
  }
}