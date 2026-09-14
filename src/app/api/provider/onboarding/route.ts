import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { createSessionToken, getSession, sessionCookieOptions } from "@/lib/session";
import { resolveLocation } from "@/lib/services/locationService";
import { audit } from "@/lib/services/auditService";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  
  const businessName = String(b.businessName || "").trim();
  const phone = String(b.phone || "").replace(/\D/g, "");
  const selectedCategories: string[] = Array.isArray(b.categories) ? b.categories : [];

  if (!businessName) return fail("Business name is required");
  if (phone.length < 10) return fail("Valid 10-digit mobile phone number is required");
  if (selectedCategories.length === 0) return fail("Please select at least one asset or service category");

  // Determine user context
  let session = getSession();
  let userId = session?.userId;

  if (!userId) {
    // If not authenticated, check if user exists by phone or create new user
    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone,
          name: b.ownerName ? String(b.ownerName).slice(0, 60) : businessName,
          role: "PROVIDER",
        },
      });
      await audit("SYSTEM", user.id, "SIGNUP_PROVIDER", "User", user.id, { via: "onboarding" });
    } else if (user.role === "CUSTOMER") {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: "PROVIDER" },
      });
    }
    userId = user.id;
  } else {
    // Upgrade existing user role if CUSTOMER
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user && user.role === "CUSTOMER") {
      await prisma.user.update({ where: { id: userId }, data: { role: "PROVIDER" } });
    }
  }

  // Location resolution
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
  if (lat == null || lng == null) {
    lat = 15.4771;
    lng = 78.4807;
    addressText = addressText || "Nandyal";
  }

  // Create Provider Organization
  const providerType = selectedCategories.includes("CAR") || selectedCategories.includes("BIKE") || selectedCategories.includes("AUTO") || selectedCategories.includes("TRUCK")
    ? "VEHICLE_OWNER"
    : selectedCategories.includes("TRACTOR") || selectedCategories.includes("HARVESTER") || selectedCategories.includes("CONSTRUCTION")
    ? "FARM"
    : selectedCategories.includes("GARAGE")
    ? "GARAGE"
    : selectedCategories.includes("DRIVER")
    ? "DRIVER"
    : "VEHICLE_OWNER";

  const provider = await prisma.provider.create({
    data: {
      type: providerType,
      businessName,
      phone,
      about: b.about ? String(b.about).slice(0, 500) : `Near Wheels multi-asset provider listing for ${businessName}`,
      userId,
      status: "ACTIVE",
      availabilityStatus: "AVAILABLE_NOW",
      lat,
      lng,
      addressText,
      serviceRadiusKm: typeof b.serviceRadiusKm === "number" ? b.serviceRadiusKm : 25,
      autoAccept: b.autoAccept !== false,
      docsJson: JSON.stringify({ selfDeclared: true, categories: selectedCategories, createdAt: new Date().toISOString() }),
    },
  });

  // Create ProviderMember relationship
  await prisma.providerMember.upsert({
    where: { providerId_userId: { providerId: provider.id, userId } },
    create: { providerId: provider.id, userId, role: "OWNER" },
    update: { role: "OWNER" },
  });

  // Assign Free Plan
  const freePlan = await prisma.subscriptionPlan.findUnique({ where: { code: "FREE" } });
  if (freePlan) {
    await prisma.providerSubscription.create({
      data: { providerId: provider.id, planId: freePlan.id, status: "ACTIVE" },
    });
  }

  // Create Type-Specific Assets & Services
  const vehicleCategories = ["CAR", "BIKE", "AUTO", "TRUCK", "TRAVELLER"];
  const equipmentCategories = ["TRACTOR", "HARVESTER", "CONSTRUCTION"];

  // 1. Vehicles (Cars, Bikes, Autos, Trucks, Travellers)
  for (const cat of selectedCategories) {
    if (vehicleCategories.includes(cat)) {
      const vDetails = b.vehicles?.[cat] || {};
      const title = vDetails.title || vDetails.model ? `${vDetails.make || ""} ${vDetails.model || cat}`.trim() : `My ${cat}`;
      
      const createdVehicle = await prisma.vehicle.create({
        data: {
          providerId: provider.id,
          category: cat === "TRAVELLER" ? "VAN" : cat,
          make: vDetails.make || "Standard",
          model: vDetails.model || cat,
          title,
          seats: Number(vDetails.seats) || (cat === "BIKE" ? 2 : cat === "AUTO" ? 3 : cat === "TRAVELLER" ? 12 : 4),
          transmission: vDetails.transmission || "MANUAL",
          fuelType: vDetails.fuelType || "PETROL",
          ac: typeof vDetails.ac === "boolean" ? vDetails.ac : true,
          selfDriveAllowed: !!vDetails.selfDriveAllowed,
          withDriverAllowed: vDetails.withDriverAllowed !== false,
          status: "ACTIVE",
          registrationNumber: vDetails.registrationNumber || null,
          year: Number(vDetails.year) || new Date().getFullYear(),
          specsJson: JSON.stringify({
            engineCc: vDetails.engineCc ? Number(vDetails.engineCc) : null,
            helmetIncluded: !!vDetails.helmetIncluded,
            loadCapacityTons: vDetails.loadCapacityTons ? Number(vDetails.loadCapacityTons) : null,
          }),
        },
      });

      // Default pricing rule
      await prisma.pricingRule.create({
        data: {
          ownerProviderId: provider.id,
          targetType: "VEHICLE",
          targetId: createdVehicle.id,
          model: cat === "BIKE" || cat === "CAR" ? "DAILY" : cat === "AUTO" ? "PER_KM" : "MIXED",
          dailyRate: vDetails.dailyRate ? Number(vDetails.dailyRate) : cat === "BIKE" ? 400 : cat === "CAR" ? 2000 : null,
          perKm: vDetails.perKm ? Number(vDetails.perKm) : cat === "AUTO" ? 18 : cat === "TRUCK" ? 40 : null,
          hourlyRate: vDetails.hourlyRate ? Number(vDetails.hourlyRate) : null,
          deposit: vDetails.deposit ? Number(vDetails.deposit) : 1000,
        },
      });
    }
  }

  // 2. Heavy Equipment (Tractors, Harvesters, Construction / JCB)
  for (const cat of selectedCategories) {
    if (equipmentCategories.includes(cat)) {
      const eq = b.equipment?.[cat] || {};
      const title = eq.title || `${eq.brand || ""} ${cat}`.trim();
      const eqType = cat === "TRACTOR" ? "TRACTOR" : cat === "HARVESTER" ? "HARVESTER" : "AGRI_MACHINE";

      const createdEq = await prisma.farmEquipment.create({
        data: {
          providerId: provider.id,
          equipmentType: eqType,
          title: title || `John Deere ${cat}`,
          hp: eq.hp ? Number(eq.hp) : 55,
          capacityAcresPerDay: eq.capacityAcresPerDay ? Number(eq.capacityAcresPerDay) : 20,
          attachments: JSON.stringify(Array.isArray(eq.attachments) ? eq.attachments : []),
          status: "ACTIVE",
        },
      });

      // Also create matching Vehicle record with category TRACTOR/HARVESTER/EXCAVATOR for unified search & booking
      const vehCat = cat === "TRACTOR" ? "TRACTOR" : cat === "HARVESTER" ? "HARVESTER" : "EXCAVATOR";
      const createdEqVehicle = await prisma.vehicle.create({
        data: {
          providerId: provider.id,
          category: vehCat,
          make: eq.brand || "Standard",
          model: eq.model || cat,
          title: title || `${cat} Equipment`,
          seats: 1,
          status: "ACTIVE",
          specsJson: JSON.stringify({
            horsepower: eq.hp ? Number(eq.hp) : 55,
            engineHours: eq.engineHours ? Number(eq.engineHours) : 1200,
            operatingHours: eq.operatingHours ? Number(eq.operatingHours) : 1200,
            bucketCapacity: eq.bucketCapacity || null,
            diggingDepth: eq.diggingDepth || null,
            cropType: eq.cropType || ["PADDY", "MAIZE"],
            attachments: Array.isArray(eq.attachments) ? eq.attachments : [],
          }),
        },
      });

      // Pricing rule for equipment
      await prisma.pricingRule.create({
        data: {
          ownerProviderId: provider.id,
          targetType: "FARM_EQUIPMENT",
          targetId: createdEq.id,
          model: "PER_ACRE",
          perAcre: eq.perAcre ? Number(eq.perAcre) : cat === "TRACTOR" ? 800 : 1500,
          hourlyRate: eq.hourlyRate ? Number(eq.hourlyRate) : 1200,
          minAcres: 2,
        },
      });

      await prisma.pricingRule.create({
        data: {
          ownerProviderId: provider.id,
          targetType: "VEHICLE",
          targetId: createdEqVehicle.id,
          model: "PER_ACRE",
          perAcre: eq.perAcre ? Number(eq.perAcre) : cat === "TRACTOR" ? 800 : 1500,
          hourlyRate: eq.hourlyRate ? Number(eq.hourlyRate) : 1200,
          minAcres: 2,
        },
      });
    }
  }

  // 3. Garage Services
  if (selectedCategories.includes("GARAGE")) {
    const g = b.garage || {};
    await prisma.garageProfile.create({
      data: {
        providerId: provider.id,
        services: JSON.stringify(Array.isArray(g.services) && g.services.length ? g.services : ["MECHANIC", "TOWING", "BATTERY", "TYRE", "AC_REPAIR"]),
        open24x7: g.open24x7 !== false,
        opensAt: g.opensAt || "08:00",
        closesAt: g.closesAt || "20:00",
        pickupDrop: g.pickupDrop !== false,
      },
    });

    await prisma.pricingRule.create({
      data: {
        ownerProviderId: provider.id,
        targetType: "GARAGE_SERVICE",
        model: "PER_VISIT",
        visitCharge: g.visitCharge ? Number(g.visitCharge) : 300,
        minCharge: 300,
      },
    });
  }

  // 4. Driver Services
  if (selectedCategories.includes("DRIVER")) {
    const d = b.driver || {};
    const driverProf = await prisma.driverProfile.create({
      data: {
        providerId: provider.id,
        experienceYears: d.experienceYears ? Number(d.experienceYears) : 5,
        licenseType: d.licenseType || "LMV_TR",
        hasOwnVehicle: !!d.hasOwnVehicle,
        languages: JSON.stringify(Array.isArray(d.languages) && d.languages.length ? d.languages : ["Telugu", "English"]),
        driveCategories: JSON.stringify(Array.isArray(d.driveCategories) && d.driveCategories.length ? d.driveCategories : ["CAR", "SUV", "VAN"]),
      },
    });

    await prisma.pricingRule.create({
      data: {
        ownerProviderId: provider.id,
        targetType: "DRIVER",
        targetId: driverProf.id,
        model: "DAILY",
        dailyRate: d.dailyRate ? Number(d.dailyRate) : 900,
        hourlyRate: d.hourlyRate ? Number(d.hourlyRate) : 130,
      },
    });
  }

  // 5. Driving School Service
  if (selectedCategories.includes("DRIVING_SCHOOL")) {
    const ds = b.drivingSchool || {};
    const school = await prisma.drivingSchool.create({
      data: {
        ownerId: userId,
        schoolName: ds.schoolName || `${businessName} Driving Academy`,
        ownerName: ds.ownerName || businessName,
        phone,
        email: b.email || null,
        description: ds.description || "Professional driving school with certified instructors.",
        address: addressText || "Nandyal",
        city: "Nandyal",
        state: "Telangana",
        lat,
        lng,
        status: "VERIFIED",
        isActive: true,
      },
    });

    // Default Course
    await prisma.drivingCourse.create({
      data: {
        schoolId: school.id,
        courseName: "Four-Wheeler Beginner Course",
        courseType: "BEGINNER_DRIVING",
        numLessons: 15,
        lessonDuration: 30,
        price: 4500,
        vehicleType: "CAR",
        transmission: "MANUAL",
      },
    });
  }

  await audit("PROVIDER", userId, "COMPLETE_ONBOARDING", "Provider", provider.id, { categories: selectedCategories });

  // Issue updated session token
  const token = createSessionToken({ userId, role: "PROVIDER", name: businessName });
  const res = ok({
    success: true,
    providerId: provider.id,
    businessName: provider.businessName,
    categories: selectedCategories,
    message: "Provider organization and assets created successfully!",
  });

  res.cookies.set(sessionCookieOptions().name, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: sessionCookieOptions().maxAge,
    path: "/",
  });

  return res;
}
