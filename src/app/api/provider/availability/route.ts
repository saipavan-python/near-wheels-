import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { getSession } from "@/lib/session";
import { checkProviderAccess } from "@/lib/rbac";

export const runtime = "nodejs";

const VALID_REASONS = [
  "Personal use",
  "Maintenance",
  "Already booked elsewhere",
  "Driver unavailable",
  "Documents expired",
  "Other",
];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return fail("Login required", 401);

  const { searchParams } = new URL(req.url);
  const vehicleId = searchParams.get("vehicleId");

  if (!vehicleId) return fail("vehicleId parameter is required");

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return fail("Vehicle not found", 404);

  const allowed = await checkProviderAccess(prisma, session.userId, vehicle.providerId, "availability.read");
  if (!allowed) return fail("Access denied", 403);

  const records = await prisma.vehicleAvailability.findMany({
    where: { vehicleId },
    orderBy: { startDate: "desc" },
  });

  return ok({ vehicleId, availabilities: records, reasons: VALID_REASONS });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return fail("Login required", 401);

  const b = await req.json().catch(() => ({}));
  const vehicleId = String(b.vehicleId || "");
  const reason = String(b.reason || "Maintenance");
  const note = b.note ? String(b.note).slice(0, 300) : null;
  const startDateStr = String(b.startDate || "");
  const endDateStr = String(b.endDate || "");

  if (!vehicleId) return fail("vehicleId is required");

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return fail("Vehicle not found", 404);

  const allowed = await checkProviderAccess(prisma, session.userId, vehicle.providerId, "availability.update");
  if (!allowed) return fail("Access denied: availability.update required", 403);

  const start = startDateStr ? new Date(startDateStr) : new Date();
  const end = endDateStr ? new Date(endDateStr) : new Date(Date.now() + 24 * 3600_000);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    return fail("Invalid start or end date range");
  }

  // Create availability block record
  const record = await prisma.vehicleAvailability.create({
    data: {
      vehicleId,
      startDate: start,
      endDate: end,
      status: "UNAVAILABLE",
      reason,
      note,
      createdBy: session.userId,
    },
  });

  // Also update vehicle's overall status to NOT_AVAILABLE if current time falls within range
  const now = new Date();
  if (start <= now && now <= end) {
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status: "NOT_AVAILABLE" },
    });
  }

  return ok({ availability: record, message: `Asset marked unavailable: ${reason}` });
}

export const dynamic = "force-dynamic";