import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { getSession } from "@/lib/session";
import { checkProviderAccess } from "@/lib/rbac";

export const runtime = "nodejs";

// Helper to resolve providerId for authenticated user
async function resolveUserProviderId(userId: string, requestedProviderId?: string | null) {
  if (requestedProviderId) {
    const allowed = await checkProviderAccess(prisma, userId, requestedProviderId, "assets.read");
    if (!allowed) return null;
    return requestedProviderId;
  }
  
  // Find first provider where user is owner or member
  const member = await prisma.providerMember.findFirst({
    where: { userId },
    select: { providerId: true },
  });
  if (member) return member.providerId;

  const provider = await prisma.provider.findFirst({
    where: { userId },
    select: { id: true },
  });
  return provider?.id || null;
}

export async function GET(req: NextRequest) {
  const session = getSession();
  if (!session) return fail("Login required", 401);

  const { searchParams } = new URL(req.url);
  const requestedProviderId = searchParams.get("providerId");

  const providerId = await resolveUserProviderId(session.userId, requestedProviderId);
  if (!providerId) return fail("No provider organization found for this user", 403);

  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    include: {
      vehicles: {
        include: { availabilities: { orderBy: { createdAt: "desc" }, take: 5 } },
        orderBy: { createdAt: "desc" },
      },
      farmEquipment: { orderBy: { createdAt: "desc" } },
      driverProfile: true,
      garageProfile: true,
      droneProfile: true,
      pricingRules: true,
    },
  });

  if (!provider) return fail("Provider not found", 444);

  // Normalize pricing rules lookup
  const pricingMap = new Map();
  for (const r of provider.pricingRules) {
    if (r.targetId) pricingMap.set(r.targetId, r);
    else if (r.targetType && !pricingMap.has(r.targetType)) pricingMap.set(r.targetType, r);
  }

  const assets = [
    ...provider.vehicles.map((v) => ({
      id: v.id,
      kind: "VEHICLE",
      category: v.category,
      title: v.title,
      make: v.make,
      model: v.model,
      status: v.status,
      seats: v.seats,
      fuelType: v.fuelType,
      transmission: v.transmission,
      ac: v.ac,
      registrationNumber: v.registrationNumber,
      year: v.year,
      imageUrl: v.imageUrl,
      specs: JSON.parse(v.specsJson || "{}"),
      pricing: pricingMap.get(v.id) || pricingMap.get("VEHICLE") || null,
      availabilities: v.availabilities,
    })),
    ...provider.farmEquipment.map((e) => ({
      id: e.id,
      kind: "EQUIPMENT",
      category: e.equipmentType,
      title: e.title,
      make: "Agri",
      model: e.equipmentType,
      status: e.status,
      hp: e.hp,
      capacityAcresPerDay: e.capacityAcresPerDay,
      attachments: JSON.parse(e.attachments || "[]"),
      pricing: pricingMap.get(e.id) || pricingMap.get("FARM_EQUIPMENT") || null,
    })),
  ];

  return ok({
    providerId: provider.id,
    businessName: provider.businessName,
    type: provider.type,
    assetCount: assets.length,
    assets,
    garageProfile: provider.garageProfile,
    driverProfile: provider.driverProfile,
  });
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return fail("Login required", 401);

  const b = await req.json().catch(() => ({}));
  const requestedProviderId = b.providerId;

  const providerId = await resolveUserProviderId(session.userId, requestedProviderId);
  if (!providerId) return fail("Unauthorized to add assets for this provider", 403);

  const allowed = await checkProviderAccess(prisma, session.userId, providerId, "assets.create");
  if (!allowed) return fail("Permission denied: assets.create required", 403);

  const category = String(b.category || "CAR").toUpperCase();
  const title = String(b.title || `${b.make || ""} ${b.model || category}`).trim();

  if (!title) return fail("Title or model name is required");

  const vehicle = await prisma.vehicle.create({
    data: {
      providerId,
      category,
      make: b.make ? String(b.make) : "Standard",
      model: b.model ? String(b.model) : category,
      title,
      seats: Number(b.seats) || 4,
      fuelType: b.fuelType ? String(b.fuelType) : "PETROL",
      transmission: b.transmission ? String(b.transmission) : "MANUAL",
      ac: typeof b.ac === "boolean" ? b.ac : true,
      selfDriveAllowed: !!b.selfDriveAllowed,
      withDriverAllowed: b.withDriverAllowed !== false,
      status: "ACTIVE",
      registrationNumber: b.registrationNumber || null,
      specsJson: JSON.stringify(b.specs || {}),
    },
  });

  // Create pricing rule if provided
  if (b.pricing) {
    await prisma.pricingRule.create({
      data: {
        ownerProviderId: providerId,
        targetType: "VEHICLE",
        targetId: vehicle.id,
        model: b.pricing.model || "DAILY",
        dailyRate: b.pricing.dailyRate ? Number(b.pricing.dailyRate) : null,
        perKm: b.pricing.perKm ? Number(b.pricing.perKm) : null,
        perAcre: b.pricing.perAcre ? Number(b.pricing.perAcre) : null,
        hourlyRate: b.pricing.hourlyRate ? Number(b.pricing.hourlyRate) : null,
        deposit: b.pricing.deposit ? Number(b.pricing.deposit) : null,
      },
    });
  }

  return ok({ asset: vehicle, message: "Asset added successfully" });
}
