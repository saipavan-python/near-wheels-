import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { getSession } from "@/lib/session";
import { operatorForUser, parseDateOnly, validateStops } from "@/lib/services/yatraService";

export const runtime = "nodejs";

async function getOperator() {
  const session = getSession();
  if (!session) return { error: fail("Authentication required", 401) };
  const operator = await operatorForUser(session.userId);
  if (!operator) return { error: fail("Vehicle-owner access required", 403) };
  return { operator };
}

export async function GET() {
  const result = await getOperator();
  if (result.error) return result.error;
  const packages = await prisma.yatraBusPackage.findMany({
    where: { operatorId: result.operator!.id },
    include: { stops: { orderBy: { order: "asc" } }, vehicle: true },
    orderBy: { departureDate: "asc" },
  });
  return ok({ packages });
}

export async function POST(req: NextRequest) {
  const result = await getOperator();
  if (result.error) return result.error;
  const body = await req.json().catch(() => ({}));
  const packageName = String(body.packageName || "").trim();
  const description = String(body.description || "").trim();
  const pricePerHead = Number(body.pricePerHead);
  const totalSeats = Number(body.totalSeats);
  const departureDate = parseDateOnly(body.departureDate);
  const returnDate = body.returnDate ? parseDateOnly(body.returnDate) : null;

  if (!packageName) return fail("Package name is required");
  if (description.length < 20 || description.length > 2000) return fail("Description must be 20 to 2000 characters");
  if (!Number.isFinite(pricePerHead) || pricePerHead <= 0) return fail("Price must be greater than zero");
  if (!Number.isInteger(totalSeats) || totalSeats <= 0) return fail("Total seats must be greater than zero");
  if (!departureDate || departureDate < new Date(new Date().toISOString().slice(0, 10))) return fail("Departure date cannot be in the past");
  if (body.returnDate && (!returnDate || returnDate < departureDate)) return fail("Return date must be on or after departure date");

  let stops;
  try { stops = validateStops(body.stops); } catch (error) { return fail(error instanceof Error ? error.message : "Invalid temple stops"); }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: String(body.vehicleId || ""), providerId: result.operator!.id, category: "BUS", status: "ACTIVE" },
  });
  if (!vehicle) return fail("Select an active bus owned by your operator account");
  const driverId = body.driverId ? String(body.driverId) : null;
  if (driverId) {
    const driver = await prisma.driverProfile.findFirst({ where: { id: driverId, provider: { userId: getSession()!.userId } } });
    if (!driver) return fail("Selected driver is not managed by your operator account");
  }

  const created = await prisma.$transaction(async (tx) => {
    const yatra = await tx.yatraBusPackage.create({
      data: {
        operatorId: result.operator!.id,
        vehicleId: vehicle.id,
        driverId,
        packageName,
        description,
        category: String(body.category || "TEMPLE_YATRA"),
        pricePerHead,
        totalSeats,
        departureDate,
        returnDate,
        durationDays: body.durationDays ? Number(body.durationDays) : null,
        stops: { create: stops.map((stop, index) => ({ ...stop, order: index + 1 })) },
        seats: { create: Array.from({ length: totalSeats }, (_, index) => ({ number: index + 1 })) },
      },
      include: { stops: true, vehicle: true },
    });
    return yatra;
  });
  return ok({ package: created }, { status: 201 });
}
export const dynamic = "force-dynamic";