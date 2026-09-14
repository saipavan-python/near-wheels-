import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { startOfDay, endOfDay } from "@/lib/services/availabilityService";

export const runtime = "nodejs";

async function requireProvider() {
  const session = getSession();
  if (!session) throw new Error("Login required");
  if (session.role !== "PROVIDER" && session.role !== "ADMIN") throw new Error("Provider access required");
  const provider = await prisma.provider.findFirst({ where: { userId: session.userId } });
  if (!provider) throw new Error("No provider profile");
  return { session, provider };
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const { provider, session } = await requireProvider();
    const v = await prisma.vehicle.findUnique({ where: { id: ctx.params.id } });
    if (!v) return fail("Vehicle not found", 404);
    if (v.providerId !== provider.id && session.role !== "ADMIN") return fail("Not your vehicle", 403);
    if (v.status !== "ACTIVE") return fail("Vehicle must be ACTIVE", 400);

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    // Check existing today block
    const existing = await prisma.vehicleAvailability.findFirst({
      where: {
        vehicleId: v.id,
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart },
      },
    });
    if (existing) return fail("Already marked unavailable for today", 409);

    // Check booking today
    const booking = await prisma.booking.findFirst({
      where: {
        listingKind: "VEHICLE",
        listingId: v.id,
        status: { in: ["REQUESTED", "PENDING_PROVIDER", "ACCEPTED", "CONFIRMED", "EN_ROUTE", "IN_PROGRESS"] },
        scheduledFor: { gte: new Date(todayStart.getTime() - 24*3600_000), lte: new Date(todayEnd.getTime() + 24*3600_000) },
      },
    });
    if (booking) return fail(`Cannot mark unavailable — booking ${booking.code} exists for today`, 409);

    const b = await req.json().catch(() => ({}));
    const reason = b.reason ? String(b.reason).toUpperCase() : "OTHER";
    const allowed = ["MAINTENANCE","PERSONAL_USE","EXTERNAL_RENT","OTHER"];
    const finalReason = allowed.includes(reason) ? reason : "OTHER";

    const created = await prisma.vehicleAvailability.create({
      data: {
        vehicleId: v.id,
        startDate: todayStart,
        endDate: todayEnd,
        status: finalReason === "MAINTENANCE" ? "MAINTENANCE" : "UNAVAILABLE",
        reason: finalReason,
        note: b.note ? String(b.note).slice(0,300) : null,
        createdBy: session.userId,
      },
    });
    return ok({ availability: created }, { status: 201 });
  } catch (e: any) {
    const m = e.message || "Failed";
    if (m.includes("Login")) return fail(m, 401);
    if (m.includes("Provider")) return fail(m, 403);
    return fail(m, 400);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const { provider, session } = await requireProvider();
    const v = await prisma.vehicle.findUnique({ where: { id: ctx.params.id } });
    if (!v) return fail("Vehicle not found", 404);
    if (v.providerId !== provider.id && session.role !== "ADMIN") return fail("Not your vehicle", 403);
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const existing = await prisma.vehicleAvailability.findFirst({
      where: { vehicleId: v.id, startDate: { lte: todayEnd }, endDate: { gte: todayStart } },
    });
    if (!existing) return fail("No unavailable block for today", 404);
    await prisma.vehicleAvailability.delete({ where: { id: existing.id } });
    return ok({ deleted: true });
  } catch (e: any) {
    return fail(e?.message || "Failed", 400);
  }
}
