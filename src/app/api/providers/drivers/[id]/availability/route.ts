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

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const { provider } = await requireProvider();
    const dr = await prisma.driver.findUnique({ where: { id: ctx.params.id } });
    if (!dr) return fail("Driver not found", 404);
    if (dr.providerId !== provider.id && getSession()?.role !== "ADMIN") return fail("Not your driver", 403);

    const availabilities = await prisma.driverAvailability.findMany({
      where: { driverId: dr.id },
      orderBy: { startAt: "asc" },
    });

    const bookings = await prisma.booking.findMany({
      where: {
        listingKind: "DRIVER",
        listingId: dr.id,
        status: { in: ["REQUESTED", "PENDING_PROVIDER", "ACCEPTED", "CONFIRMED", "EN_ROUTE", "IN_PROGRESS"] },
      },
      orderBy: { scheduledFor: "asc" },
      select: { id: true, code: true, status: true, scheduledFor: true, durationDays: true, customerId: true },
    });

    return ok({ availabilities, bookings, driver: { id: dr.id, name: dr.name } });
  } catch (e: any) {
    const m = e.message || "Failed";
    if (m.includes("Login")) return fail(m, 401);
    if (m.includes("Provider") || m.includes("Not your")) return fail(m, 403);
    return fail(m, 400);
  }
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const { provider, session } = await requireProvider();
    const dr = await prisma.driver.findUnique({ where: { id: ctx.params.id } });
    if (!dr) return fail("Driver not found", 404);
    if (dr.providerId !== provider.id && session.role !== "ADMIN") return fail("Not your driver", 403);
    if (dr.status !== "ACTIVE") return fail("Driver must be ACTIVE to manage availability", 400);

    const b = await req.json().catch(() => ({}));
    let startRaw = b.startDate || b.startAt || b.start || b.date;
    let endRaw = b.endDate || b.endAt || b.end || b.date;
    if (!startRaw) return fail("startDate is required");

    let start = new Date(startRaw);
    let end = endRaw ? new Date(endRaw) : new Date(startRaw);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return fail("Invalid date format");

    start = startOfDay(start);
    end = endOfDay(end);
    if (end < start) return fail("End date cannot be before start date");

    // Max range guard (like vehicles: 60 days)
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    if (diffDays > 60) return fail("Availability period cannot exceed 60 days");

    const todayStart = startOfDay(new Date());
    if (end < todayStart) return fail("Cannot mark past dates as unavailable");

    // Overlap check
    const overlap = await prisma.driverAvailability.findFirst({
      where: {
        driverId: dr.id,
        AND: [
          { startAt: { lte: end } },
          { endAt: { gte: start } },
        ],
      },
    });
    if (overlap) return fail(`Already marked unavailable for ${overlap.startAt.toISOString().slice(0, 10)} → ${overlap.endAt.toISOString().slice(0, 10)}`, 409);

    // Booking conflict in that range
    const bookingConflict = await prisma.booking.findFirst({
      where: {
        listingKind: "DRIVER",
        listingId: dr.id,
        status: { in: ["REQUESTED", "PENDING_PROVIDER", "ACCEPTED", "CONFIRMED", "EN_ROUTE", "IN_PROGRESS"] },
        scheduledFor: {
          gte: new Date(start.getTime() - 24 * 3600_000),
          lte: new Date(end.getTime() + 24 * 3600_000),
        },
      },
    });
    if (bookingConflict) {
      return fail(`Cannot mark unavailable — booking ${bookingConflict.code} exists on ${bookingConflict.scheduledFor ? new Date(bookingConflict.scheduledFor).toISOString().slice(0, 10) : "that date"}`, 409);
    }

    const reason = b.reason ? String(b.reason).toUpperCase() : "OTHER";
    const allowedReasons = ["OFF_DUTY", "ON_LEAVE", "ON_TRIP", "OTHER"];
    const finalReason = allowedReasons.includes(reason) ? reason : "OTHER";
    const status = "BLOCKED";

    const created = await prisma.driverAvailability.create({
      data: {
        driverId: dr.id,
        startAt: start,
        endAt: end,
        status,
        note: b.note ? String(b.note).slice(0, 300) : finalReason !== "OTHER" ? finalReason : null,
      },
    });

    return ok({ availability: created }, { status: 201 });
  } catch (e: any) {
    console.error("POST driver availability", e);
    const m = e.message || "Failed to create";
    if (m.includes("Login")) return fail(m, 401);
    if (m.includes("Provider") || m.includes("Not your")) return fail(m, 403);
    return fail(m, 400);
  }
}