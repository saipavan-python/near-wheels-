import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { parse } from "@/lib/utils";
import { isVehicleBlockedByAvailability, startOfDay, endOfDay } from "@/lib/services/availabilityService";

export const runtime = "nodejs";

async function requireProvider() {
  const session = getSession();
  if (!session) throw new Error("Login required");
  if (session.role !== "PROVIDER" && session.role !== "ADMIN") throw new Error("Provider access required");
  const provider = await prisma.provider.findFirst({ where: { userId: session.userId } });
  if (!provider) throw new Error("No provider profile â€” register as provider first");
  return { session, provider };
}

export async function GET() {
  try {
    const { provider } = await requireProvider();
    const vehicles = await prisma.vehicle.findMany({
      where: { providerId: provider.id },
      orderBy: { createdAt: "desc" },
      include: { availabilities: { where: { endDate: { gte: startOfDay(new Date()) } }, orderBy: { startDate: "asc" } } },
    });

    // Enrich with today's availability status and upcoming blocks + pricing
    const rules = await prisma.pricingRule.findMany({ where: { ownerProviderId: provider.id, active: true } });

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    // Batch booking counts for all vehicles (was 2 queries per vehicle -> 2 total)
    const ACTIVE_STATUSES = ["REQUESTED", "PENDING_PROVIDER", "ACCEPTED", "CONFIRMED", "EN_ROUTE", "IN_PROGRESS"];
    const ids = vehicles.map((v) => v.id);
    const bookingCounts = await prisma.booking.groupBy({
      by: ["listingId"],
      where: { listingKind: "VEHICLE", listingId: { in: ids }, status: { in: ACTIVE_STATUSES } },
      _count: { _all: true },
    });
    const activeCountById = new Map(bookingCounts.map((r) => [r.listingId, r._count._all]));
    const todayCounts = await prisma.booking.groupBy({
      by: ["listingId"],
      where: {
        listingKind: "VEHICLE",
        listingId: { in: ids },
        status: { in: ACTIVE_STATUSES },
        scheduledFor: { gte: todayStart, lte: todayEnd },
      },
      _count: { _all: true },
    });
    const todayCountById = new Map(todayCounts.map((r) => [r.listingId, r._count._all]));

    const enriched = vehicles.map((v) => {
      const todayBlock = v.availabilities.find((a) => new Date(a.startDate) <= todayEnd && new Date(a.endDate) >= todayStart);
      const upcomingBlocks = v.availabilities.filter((a) => new Date(a.startDate) > todayEnd).slice(0, 3);
      const activeBookings = activeCountById.get(v.id) || 0;
      const todayBookings = todayCountById.get(v.id) || 0;
      const rule = rules.find((r) => r.targetId === v.id) || rules.find((r) => r.targetType === "VEHICLE") || null;
      return {
        ...v,
        images: parse(v.imagesJson, []) as string[],
        isUnavailableToday: !!todayBlock,
        todayBlock: todayBlock || null,
        upcomingBlocks,
        activeBookings,
        todayBookings,
        pricing: rule ? {
          model: rule.model,
          dailyRate: rule.dailyRate,
          hourlyRate: rule.hourlyRate,
          perKm: rule.perKm,
          deposit: rule.deposit,
        } : null,
        availableAgain: todayBlock ? (() => { const d = new Date(todayBlock.endDate); d.setDate(d.getDate()+1); return d.toISOString(); })() : null,
      };
    });

    return ok({ vehicles: enriched, providerId: provider.id });
  } catch (e: any) {
    const msg = e.message || "Failed to fetch vehicles";
    if (msg.includes("Login")) return fail(msg, 401);
    if (msg.includes("Provider")) return fail(msg, 403);
    console.error("GET vehicles");
    return fail("Failed to load vehicles", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { provider } = await requireProvider();
    const b = await req.json().catch(() => ({}));

    // Basic validation
    const category = String(b.category || b.vehicleType || "CAR").toUpperCase();
    const make = String(b.make || "").trim();
    const model = String(b.model || "").trim();
    if (!make || !model) return fail("Make and model are required");
    if (!category) return fail("Vehicle type is required");

    const title = String(b.title || `${make} ${model}`).trim();
    const variant = b.variant ? String(b.variant).trim() : null;
    const year = b.year ? Number(b.year) : null;
    if (year && (year < 1990 || year > 2030)) return fail("Year must be between 1990 and 2030");
    const registrationNumber = b.registrationNumber ? String(b.registrationNumber).trim().toUpperCase() : null;
    const seats = b.seats ? Number(b.seats) : 4;
    const transmission = b.transmission ? String(b.transmission).toUpperCase() : null;
    const fuelType = b.fuelType ? String(b.fuelType).toUpperCase() : null;
    const ac = typeof b.ac === "boolean" ? b.ac : b.ac === "true" ? true : b.ac === "false" ? false : null;
    const selfDriveAllowed = !!b.selfDriveAllowed;
    const withDriverAllowed = b.withDriverAllowed !== false;
    const loadCapacityTons = b.loadCapacityTons != null ? Number(b.loadCapacityTons) : null;
    const color = b.color ? String(b.color).trim() : null;
    const imageUrl = b.imageUrl ? String(b.imageUrl).trim() : null;
    const images = Array.isArray(b.images) ? b.images.slice(0, 10).map(String) : Array.isArray(b.imageUrls) ? b.imageUrls.slice(0,10).map(String) : [];
    const allImages = imageUrl ? [imageUrl, ...images.filter((u:string)=>u!==imageUrl)] : images;

    // Location: prefer vehicle pickup if provided, else provider base
    let pickupLat = b.pickupLat != null ? Number(b.pickupLat) : b.lat != null ? Number(b.lat) : null;
    let pickupLng = b.pickupLng != null ? Number(b.pickupLng) : b.lng != null ? Number(b.lng) : null;
    const pickupAddress = b.pickupAddress ? String(b.pickupAddress).trim() : b.locationText ? String(b.locationText).trim() : null;

    // Pricing
    const pricing = b.pricing || {};
    const dailyRate = pricing.dailyRate != null ? Number(pricing.dailyRate) : b.pricePerDay != null ? Number(b.pricePerDay) : b.dailyRate != null ? Number(b.dailyRate) : null;
    const hourlyRate = pricing.hourlyRate != null ? Number(pricing.hourlyRate) : b.pricePerHour != null ? Number(b.pricePerHour) : null;
    const perKm = pricing.perKm != null ? Number(pricing.perKm) : null;
    const deposit = pricing.deposit != null ? Number(pricing.deposit) : b.deposit != null ? Number(b.deposit) : null;
    const perTrip = pricing.perTrip != null ? Number(pricing.perTrip) : null;
    const perAcre = pricing.perAcre != null ? Number(pricing.perAcre) : null;
    const visitCharge = pricing.visitCharge != null ? Number(pricing.visitCharge) : null;

    if (dailyRate != null && (dailyRate < 100 || dailyRate > 100000)) return fail("Daily rate must be between â‚¹100 and â‚¹100,000");
    if (hourlyRate != null && (hourlyRate < 50 || hourlyRate > 20000)) return fail("Hourly rate invalid");

    // Determine pricing model
    let modelPricing = String(pricing.model || b.pricingModel || "").toUpperCase();
    if (!modelPricing) {
      if (dailyRate) modelPricing = "DAILY";
      else if (hourlyRate) modelPricing = "HOURLY";
      else if (perKm) modelPricing = "PER_KM";
      else modelPricing = "DAILY";
    }

    // Validate provider ownership limit? Unlimited per spec

    const vehicle = await prisma.vehicle.create({
      data: {
        providerId: provider.id,
        category,
        make,
        model,
        variant,
        title,
        seats: seats || 4,
        transmission,
        fuelType,
        ac,
        selfDriveAllowed,
        withDriverAllowed,
        loadCapacityTons,
        status: "ACTIVE",
        year,
        color,
        registrationNumber,
        imageUrl: allImages[0] || imageUrl || null,
        imagesJson: JSON.stringify(allImages),
        pickupLat,
        pickupLng,
        pickupAddress,
      },
    });

    // Create pricing rule
    if (dailyRate || hourlyRate || perKm || perTrip || perAcre || visitCharge) {
      await prisma.pricingRule.create({
        data: {
          ownerProviderId: provider.id,
          targetType: "VEHICLE",
          targetId: vehicle.id,
          category,
          model: modelPricing,
          dailyRate,
          hourlyRate,
          perKm,
          perTrip,
          perAcre,
          deposit,
          visitCharge,
          minCharge: pricing.minCharge != null ? Number(pricing.minCharge) : null,
          includedKmPerDay: pricing.includedKmPerDay != null ? Number(pricing.includedKmPerDay) : null,
          extraPerKm: pricing.extraPerKm != null ? Number(pricing.extraPerKm) : null,
          active: true,
        },
      });
    } else {
      // Fallback default rule so vehicle appears in search with estimate
      await prisma.pricingRule.create({
        data: {
          ownerProviderId: provider.id,
          targetType: "VEHICLE",
          targetId: vehicle.id,
          category,
          model: "DAILY",
          dailyRate: 1500,
          active: true,
        },
      });
    }

    return ok({ vehicle, message: "Vehicle registered successfully" }, { status: 201 });
  } catch (e: any) {
    console.error("POST vehicle");
    return fail(e?.message || "Could not register vehicle", 400);
  }
}
