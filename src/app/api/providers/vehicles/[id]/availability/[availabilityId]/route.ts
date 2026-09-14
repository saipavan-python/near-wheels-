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

export async function DELETE(_req: NextRequest, ctx: { params: { id: string; availabilityId: string } }) {
  try {
    const { provider, session } = await requireProvider();
    const v = await prisma.vehicle.findUnique({ where: { id: ctx.params.id } });
    if (!v) return fail("Vehicle not found", 404);
    if (v.providerId !== provider.id && session.role !== "ADMIN") return fail("Not your vehicle", 403);
    const avail = await prisma.vehicleAvailability.findUnique({ where: { id: ctx.params.availabilityId } });
    if (!avail) return fail("Availability not found", 404);
    if (avail.vehicleId !== v.id) return fail("Not your availability", 403);
    await prisma.vehicleAvailability.delete({ where: { id: avail.id } });
    return ok({ deleted: true });
  } catch (e: any) {
    const m = e.message || "Failed";
    if (m.includes("Login")) return fail(m, 401);
    if (m.includes("Provider") || m.includes("Not your")) return fail(m, 403);
    return fail(m, 400);
  }
}
