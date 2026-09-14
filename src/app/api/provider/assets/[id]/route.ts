import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { getSession } from "@/lib/session";
import { checkProviderAccess } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return fail("Login required", 401);

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: params.id },
    include: {
      provider: { select: { id: true, businessName: true, userId: true } },
      availabilities: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!vehicle) return fail("Asset not found", 404);

  const allowed = await checkProviderAccess(prisma, session.userId, vehicle.providerId, "assets.read");
  if (!allowed) return fail("Access denied", 403);

  const pricing = await prisma.pricingRule.findFirst({
    where: { ownerProviderId: vehicle.providerId, OR: [{ targetId: vehicle.id }, { targetType: "VEHICLE" }] },
  });

  return ok({
    asset: {
      ...vehicle,
      specs: JSON.parse(vehicle.specsJson || "{}"),
      pricing,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return fail("Login required", 401);

  const vehicle = await prisma.vehicle.findUnique({ where: { id: params.id } });
  if (!vehicle) return fail("Asset not found", 404);

  const allowed = await checkProviderAccess(prisma, session.userId, vehicle.providerId, "assets.update");
  if (!allowed) return fail("Access denied: assets.update permission required", 403);

  const b = await req.json().catch(() => ({}));

  const updatedVehicle = await prisma.vehicle.update({
    where: { id: params.id },
    data: {
      status: b.status != null ? String(b.status).toUpperCase() : vehicle.status,
      title: b.title != null ? String(b.title).trim() : vehicle.title,
      seats: b.seats != null ? Number(b.seats) : vehicle.seats,
      fuelType: b.fuelType != null ? String(b.fuelType) : vehicle.fuelType,
      transmission: b.transmission != null ? String(b.transmission) : vehicle.transmission,
      ac: typeof b.ac === "boolean" ? b.ac : vehicle.ac,
      registrationNumber: b.registrationNumber != null ? String(b.registrationNumber) : vehicle.registrationNumber,
      imageUrl: b.imageUrl != null ? String(b.imageUrl) : vehicle.imageUrl,
      specsJson: b.specs != null ? JSON.stringify(b.specs) : vehicle.specsJson,
    },
  });

  // Update or create pricing rule if provided
  if (b.pricing) {
    const existingRule = await prisma.pricingRule.findFirst({
      where: { ownerProviderId: vehicle.providerId, targetId: vehicle.id },
    });

    if (existingRule) {
      await prisma.pricingRule.update({
        where: { id: existingRule.id },
        data: {
          model: b.pricing.model || existingRule.model,
          dailyRate: b.pricing.dailyRate != null ? Number(b.pricing.dailyRate) : existingRule.dailyRate,
          perKm: b.pricing.perKm != null ? Number(b.pricing.perKm) : existingRule.perKm,
          perAcre: b.pricing.perAcre != null ? Number(b.pricing.perAcre) : existingRule.perAcre,
          hourlyRate: b.pricing.hourlyRate != null ? Number(b.pricing.hourlyRate) : existingRule.hourlyRate,
          deposit: b.pricing.deposit != null ? Number(b.pricing.deposit) : existingRule.deposit,
        },
      });
    } else {
      await prisma.pricingRule.create({
        data: {
          ownerProviderId: vehicle.providerId,
          targetType: "VEHICLE",
          targetId: vehicle.id,
          model: b.pricing.model || "DAILY",
          dailyRate: b.pricing.dailyRate != null ? Number(b.pricing.dailyRate) : null,
          perKm: b.pricing.perKm != null ? Number(b.pricing.perKm) : null,
          perAcre: b.pricing.perAcre != null ? Number(b.pricing.perAcre) : null,
          hourlyRate: b.pricing.hourlyRate != null ? Number(b.pricing.hourlyRate) : null,
          deposit: b.pricing.deposit != null ? Number(b.pricing.deposit) : null,
        },
      });
    }
  }

  return ok({ asset: updatedVehicle, message: "Asset updated successfully" });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return fail("Login required", 401);

  const vehicle = await prisma.vehicle.findUnique({ where: { id: params.id } });
  if (!vehicle) return fail("Asset not found", 404);

  const allowed = await checkProviderAccess(prisma, session.userId, vehicle.providerId, "assets.delete");
  if (!allowed) return fail("Access denied", 403);

  await prisma.vehicle.delete({ where: { id: params.id } });
  return ok({ message: "Asset deleted successfully" });
}
