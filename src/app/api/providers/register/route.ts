import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { createSessionToken, getSession } from "@/lib/session";
import { resolveLocation } from "@/lib/services/locationService";
import { audit } from "@/lib/services/auditService";

export const runtime = "nodejs";

const TYPES = ["VEHICLE_OWNER", "DRIVER", "GARAGE", "FARM", "DRONE", "YATRA"];

/**
 * Provider registration (spec §33–37). Creates the provider in
 * PENDING_VERIFICATION — admins approve before it becomes searchable.
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const type = String(b.type || "").toUpperCase();
  if (!TYPES.includes(type)) return fail("Unknown provider type");

  const businessName = String(b.businessName || "").trim();
  const phone = String(b.phone || "").replace(/\D/g, "");
  if (!businessName || phone.length < 10) return fail("Business name and valid phone required");

  // resolve location → coordinates (mandatory for geo search)
  let lat = typeof b.lat === "number" ? b.lat : undefined;
  let lng = typeof b.lng === "number" ? b.lng : undefined;
  let addressText = b.addressText ? String(b.addressText) : null;
  if ((lat == null || lng == null) && b.locationText) {
    const r = await resolveLocation(String(b.locationText));
    if (r.resolved) {
      lat = r.resolved.lat;
      lng = r.resolved.lng;
      addressText = addressText || `${r.resolved.name}${r.resolved.district ? ", " + r.resolved.district : ""}`;
    }
  }
  if (lat == null || lng == null) return fail("Set your base location so customers can find you");

  // Yatra Bus is a BUS vehicle owner with temple package — store as VEHICLE_OWNER for compatibility with yatraService
  const dbType = type === "YATRA" ? "VEHICLE_OWNER" : type;

  // Rate limit provider registrations per IP
  const { checkRateLimit, getClientIp } = await import("@/lib/rateLimit");
  const ip = getClientIp(req);
  const rl = checkRateLimit(`provider_register:${ip}`, 5, 60 * 60_000);
  if (!rl.allowed) return fail("Too many provider registrations. Try again later.", 429);

  const existingByPhone = await prisma.provider.findFirst({ where: { phone, type: dbType } });
  if (existingByPhone) return fail("A provider with this phone already exists for this category");

  const session = getSession();
  if (!session) return fail("Please login first (via phone OTP or Google) to register as provider.", 401);
  let userId = session.userId;
  // Upgrade role if needed
  const currentUser = await prisma.user.findUnique({ where: { id: userId } });
  if (currentUser && currentUser.role === "CUSTOMER") {
    await prisma.user.update({ where: { id: userId }, data: { role: "PROVIDER" } });
  }

  const freePlan = await prisma.subscriptionPlan.findUnique({ where: { code: "FREE" } });

  const provider = await prisma.provider.create({
    data: {
      type: dbType,
      businessName,
      phone,
      about: b.about ? String(b.about).slice(0, 500) : null,
      userId,
      status: "PENDING_VERIFICATION",
      availabilityStatus: "OFFLINE",
      lat,
      lng,
      addressText,
      serviceRadiusKm: typeof b.serviceRadiusKm === "number" ? b.serviceRadiusKm : 15,
      autoAccept: !!b.autoAccept,
      docsJson: JSON.stringify({
        selfDeclared: true,
        submittedAt: new Date().toISOString(),
        docs: Array.isArray(b.documents) ? b.documents.slice(0, 10).map((d: unknown) => String(d)) : [],
      }),
    },
  });

  // type-specific profiles
  let createdVehicleId: string | null = null;
  try {
    switch (type) {
      case "VEHICLE_OWNER":
      case "YATRA": {
        const v = b.vehicle || {};
        if (!v.make || !v.model || !v.category) throw new Error("vehicle make, model and category are required");
        const vehicle = await prisma.vehicle.create({
          data: {
            providerId: provider.id,
            category: String(v.category),
            make: String(v.make),
            model: String(v.model),
            title: String(v.title || `${v.make} ${v.model}`),
            seats: Number(v.seats) || 4,
            transmission: v.transmission ? String(v.transmission) : null,
            fuelType: v.fuelType ? String(v.fuelType) : null,
            ac: typeof v.ac === "boolean" ? v.ac : null,
            selfDriveAllowed: !!v.selfDriveAllowed,
            withDriverAllowed: v.withDriverAllowed !== false,
            loadCapacityTons: v.loadCapacityTons != null ? Number(v.loadCapacityTons) : null,
            imageUrl: v.imageUrl ? String(v.imageUrl) : null,
            status: "PENDING_VERIFICATION",
          },
        });
        createdVehicleId = vehicle.id;
        // If YATRA provider, also create initial yatra package if yatra details provided
        if (type === "YATRA" && b.yatra) {
          const y = b.yatra as Record<string, unknown>;
          const pkgName = String(y.packageName || "").trim();
          const desc = String(y.description || "").trim();
          const price = Number(y.pricePerHead);
          const seats = Number(y.totalSeats);
          const dep = y.departureDate ? String(y.departureDate) : "";
          const ret = y.returnDate ? String(y.returnDate) : null;
          const stopsRaw = Array.isArray(y.stops) ? y.stops : [];
          if (pkgName && desc.length >= 20 && Number.isFinite(price) && price > 0 && Number.isInteger(seats) && seats > 0) {
            const { parseDateOnly, validateStops } = await import("@/lib/services/yatraService");
            const depDate = parseDateOnly(dep);
            const retDate = ret ? parseDateOnly(ret) : null;
            if (depDate) {
              try {
                const stops = validateStops(stopsRaw.length ? stopsRaw : [{ name: "Tirupati Balaji Temple" }]);
                const totalSeatsVal = seats;
                await prisma.yatraBusPackage.create({
                  data: {
                    operatorId: provider.id,
                    vehicleId: vehicle.id,
                    packageName: pkgName,
                    description: desc,
                    category: String(y.category || "TEMPLE_YATRA"),
                    pricePerHead: price,
                    totalSeats: totalSeatsVal,
                    departureDate: depDate,
                    returnDate: retDate,
                    durationDays: y.durationDays ? Number(y.durationDays) : null,
                    stops: { create: stops.map((s, i) => ({ ...s, order: i + 1 })) },
                    seats: { create: Array.from({ length: totalSeatsVal }, (_, i) => ({ number: i + 1 })) },
                  },
                });
              } catch {
                // yatra package is optional — ignore validation errors, provider still created
              }
            }
          }
        }
        break;
      }
      case "DRIVER":
        await prisma.driverProfile.create({
          data: {
            providerId: provider.id,
            experienceYears: Number(b.profile?.experienceYears) || 0,
            licenseType: b.profile?.licenseType ? String(b.profile.licenseType) : null,
            licenseImageUrl: (b.profile?.licenseImageUrl ? String(b.profile.licenseImageUrl) : null) as any,
            hasOwnVehicle: !!b.profile?.hasOwnVehicle,
            languages: JSON.stringify(
              Array.isArray(b.profile?.languages) ? b.profile.languages.slice(0, 6).map(String) : []
            ),
            driveCategories: JSON.stringify(
              Array.isArray(b.profile?.driveCategories) ? b.profile.driveCategories.slice(0, 10).map(String) : []
            ),
          },
        });
        break;
      case "GARAGE":
        await prisma.garageProfile.create({
          data: {
            providerId: provider.id,
            services: JSON.stringify(
              Array.isArray(b.profile?.services) ? b.profile.services.slice(0, 8).map(String) : ["MECHANIC"]
            ),
            open24x7: !!b.profile?.open24x7,
            opensAt: b.profile?.opensAt || null,
            closesAt: b.profile?.closesAt || null,
            pickupDrop: !!b.profile?.pickupDrop,
          },
        });
        break;
      case "FARM": {
        const e = b.equipment || {};
        if (!e.equipmentType || !e.title) throw new Error("equipment type and title are required");
        await prisma.farmEquipment.create({
          data: {
            providerId: provider.id,
            equipmentType: String(e.equipmentType),
            title: String(e.title),
            capacityAcresPerDay: e.capacityAcresPerDay != null ? Number(e.capacityAcresPerDay) : null,
            hp: e.hp != null ? Number(e.hp) : null,
            attachments: JSON.stringify(Array.isArray(e.attachments) ? e.attachments.slice(0, 8).map(String) : []),
            status: "ACTIVE",
          },
        });
        break;
      }
      case "DRONE":
        await prisma.droneProfile.create({
          data: {
            providerId: provider.id,
            dronesCount: Number(b.profile?.dronesCount) || 1,
            acresPerDay: Number(b.profile?.acresPerDay) || 20,
            sprayTypes: JSON.stringify(
              Array.isArray(b.profile?.sprayTypes) ? b.profile.sprayTypes.slice(0, 6).map(String) : ["PESTICIDE"]
            ),
            certificateNo: b.profile?.certificateNo ? String(b.profile.certificateNo) : null,
          },
        });
        break;
    }
  } catch (e: any) {
    await prisma.provider.delete({ where: { id: provider.id } });
    return fail(e?.message || "Profile details incomplete");
  }

  // starter pricing rule (editable later in dashboard)
  const p = b.pricing || {};
  await prisma.pricingRule.create({
    data: {
      ownerProviderId: provider.id,
      targetType: type === "VEHICLE_OWNER" || type === "YATRA" ? "VEHICLE" : type === "DRIVER" ? "DRIVER" : type === "GARAGE" ? "GARAGE_SERVICE" : type === "FARM" ? "FARM_EQUIPMENT" : "DRONE_SERVICE",
      model: String(p.model || (type === "FARM" || type === "DRONE" ? "PER_ACRE" : type === "GARAGE" ? "PER_VISIT" : "DAILY")),
      dailyRate: p.dailyRate != null ? Number(p.dailyRate) : null,
      hourlyRate: p.hourlyRate != null ? Number(p.hourlyRate) : null,
      perKm: p.perKm != null ? Number(p.perKm) : null,
      perTrip: p.perTrip != null ? Number(p.perTrip) : null,
      perAcre: p.perAcre != null ? Number(p.perAcre) : null,
      minAcres: p.minAcres != null ? Number(p.minAcres) : null,
      includedKmPerDay: p.includedKmPerDay != null ? Number(p.includedKmPerDay) : null,
      extraPerKm: p.extraPerKm != null ? Number(p.extraPerKm) : null,
      deposit: p.deposit != null ? Number(p.deposit) : null,
      visitCharge: p.visitCharge != null ? Number(p.visitCharge) : null,
      travelCharge: p.travelCharge != null ? Number(p.travelCharge) : null,
      minCharge: p.minCharge != null ? Number(p.minCharge) : null,
    },
  });

  if (freePlan) {
    await prisma.providerSubscription.create({
      data: { providerId: provider.id, planId: freePlan.id, status: "ACTIVE" },
    });
  }

  await audit("PROVIDER", userId, "REGISTER_PROVIDER", "Provider", provider.id, { type });

  const token = createSessionToken({ userId, role: "PROVIDER", name: businessName });
  const res = ok({ provider: { id: provider.id, status: provider.status }, message: "Registration received. Verification usually takes 1–2 days." });
  res.cookies.set("nw_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
