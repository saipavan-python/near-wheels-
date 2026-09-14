/* eslint-disable no-console */
// Near Wheels seed data — development/testing only (spec §106).
// Clearly separated from production: run with `npm run db:reset`.
const { PrismaClient } = require("@prisma/client");
const { scryptSync, randomBytes } = require("crypto");

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  console.log("Seeding Near Wheels dev database…");

  const vehicleImages = [
    "/uploads/1789023988271-ymnwkh.jpg",
    "/uploads/1789035188823-g1iwko.jpg",
    "/uploads/1789035292762-6lh0q6.png",
    "/uploads/1789315252320-017b51.jpg",
    "/uploads/1789315779450-ic79w4.png",
    "/uploads/1789354289260-ybh1w4.png",
    "/images/driver-profile.jpg",
    "/images/drone.jpg",
  ];
  let imageIdx = 0;
  function nextImage() { return vehicleImages[imageIdx++ % vehicleImages.length]; }

  // wipe (deterministic dev seed)
  const tables = [
    "payout", "commissionRecord", "payment", "review", "booking",
    "favorite", "message", "conversation", "analyticsEvent", "auditLog",
    "notification", "otpCode", "pricingRule", "providerSubscription",
    "subscriptionPlan", "vehicle", "driverProfile", "garageProfile",
    "farmEquipment", "droneProfile", "provider", "location", "user", "appSetting",
  ];
  for (const t of tables) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${t}";`).catch(() => undefined);
  }
  // reset sqlite autoincrement counters
  await prisma.$executeRawUnsafe(`DELETE FROM sqlite_sequence;`).catch(() => undefined);

  // ── Gazetteer ─────────────────────────────────────────────────────
  const L = {
     nandyal: { name: "Nandyal", type: "TOWN", district: "Nandyal", state: "Telangana", lat: 15.4771, lng: 78.4807, aliases: JSON.stringify(["nandhyal"]), popular: true },
     kurnool: { name: "Kurnool", type: "CITY", district: "Kurnool", state: "Telangana", lat: 15.8281, lng: 78.0373, aliases: JSON.stringify([]), popular: true },
     atmakur: { name: "Atmakur", type: "TOWN", district: "Nandyal", state: "Telangana", lat: 15.7521, lng: 78.5612, aliases: JSON.stringify(["atmakur nandyal"]), popular: false },
     srisailam: { name: "Srisailam", type: "RESORT_AREA", district: "Nandyal", state: "Telangana", lat: 16.0747, lng: 78.8696, aliases: JSON.stringify(["srisailam temple", "mallikarjuna"]), popular: true },
     forestGate: { name: "Nallamala Forest Gate", type: "FOREST", district: "Nandyal", state: "Telangana", lat: 15.9388, lng: 78.6822, aliases: JSON.stringify(["forest gate", "adavi gate"]), popular: true },
     banaganapalle: { name: "Banaganapalle", type: "TOWN", district: "Nandyal", state: "Telangana", lat: 15.2830, lng: 78.3170, aliases: JSON.stringify(["banaganpalli"]), popular: false },
     dhone: { name: "Dhone", type: "TOWN", district: "Nandyal", state: "Telangana", lat: 15.3960, lng: 77.8720, aliases: JSON.stringify(["dronachalam"]), popular: false },
     allagadda: { name: "Allagadda", type: "TOWN", district: "Nandyal", state: "Telangana", lat: 15.1330, lng: 78.5170, aliases: JSON.stringify([]), popular: false },
     koilkuntla: { name: "Koilkuntla", type: "TOWN", district: "Nandyal", state: "Telangana", lat: 15.1830, lng: 78.3170, aliases: JSON.stringify([]), popular: false },
     nh40point: { name: "NH-40 Nandyal Bypass", type: "HIGHWAY", district: "Nandyal", state: "Telangana", lat: 15.5020, lng: 78.4430, aliases: JSON.stringify(["nh40", "highway 40", "nh 40"]), popular: true },
     tadipatri: { name: "Tadipatri", type: "TOWN", district: "Anantapur", state: "Telangana", lat: 14.9147, lng: 78.0110, aliases: JSON.stringify(["tadpatri"]), popular: false },
     nandyalStation: { name: "Nandyal Railway Station", type: "STATION", district: "Nandyal", state: "Telangana", lat: 15.4805, lng: 78.4745, aliases: JSON.stringify(["railway station"]), popular: true },
     kurnoolAirport: { name: "Kurnool Airport", type: "AIRPORT", district: "Kurnool", state: "Telangana", lat: 15.9520, lng: 78.1900, aliases: JSON.stringify(["airport"]), popular: false },
  };
  for (const l of Object.values(L)) {
    await prisma.location.create({ data: l });
  }

  // ── Plans ─────────────────────────────────────────────────────────
  await prisma.subscriptionPlan.createMany({
    data: [
      { code: "FREE", name: "Free", monthlyFee: 0, commissionRate: 0.10, features: JSON.stringify(["Standard visibility", "10% commission"]) },
      { code: "PRO", name: "Pro", monthlyFee: 499, commissionRate: 0.06, features: JSON.stringify(["Priority in search", "6% commission", "Monthly insights"]) },
      { code: "BUSINESS", name: "Business", monthlyFee: 1499, commissionRate: 0.04, features: JSON.stringify(["Top placement", "4% commission", "Multi-listing tools"]) },
    ],
  });
  const plans = {};
  for (const p of await prisma.subscriptionPlan.findMany()) plans[p.code] = p;

  // ── Users ─────────────────────────────────────────────────────────
  const adminPhone = process.env.ADMIN_PHONE || "9000000001";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin@nearwheels";
  const demoPhone = process.env.DEMO_CUSTOMER_PHONE || "9000000002";
  await prisma.user.create({
    data: {
      phone: adminPhone,
      name: "Near Wheels Admin",
      role: "ADMIN",
      passwordHash: hashPassword(adminPassword),
    },
  });
  const demoCustomer = await prisma.user.create({
    data: { phone: demoPhone, name: "Pawan (demo)", role: "CUSTOMER" },
  });

  // helper to create provider + plan + optional profile + rules
  async function provider(data) {
    const p = await prisma.provider.create({
      data: {
        type: data.type,
        businessName: data.name,
        phone: data.phone,
        about: data.about || null,
        status: data.status || "ACTIVE",
        availabilityStatus: data.availability || "AVAILABLE_NOW",
        lat: data.lat,
        lng: data.lng,
        addressText: data.address || null,
        serviceRadiusKm: data.radius ?? 20,
        autoAccept: data.autoAccept !== false,
        responseTimeSec: data.responseSec ?? 45,
        isVerified: true,
        ratingAvg: data.rating ?? 4.5,
        ratingCount: data.ratingCount ?? 12,
        completedJobs: data.jobs ?? 18,
        cancelledJobs: data.cancels ?? 1,
        acceptedRequests: Math.round((data.jobs ?? 18) * 1.4),
        totalRequests: Math.round((data.jobs ?? 18) * 1.7),
      },
    });
    if (!data.noPlan) {
      await prisma.providerSubscription.create({
        data: { providerId: p.id, planId: plans[data.planCode || "FREE"].id, status: "ACTIVE" },
      });
    }
    return p;
  }
  async function rule(providerId, targetType, targetId, category, model, fields) {
    return prisma.pricingRule.create({
      data: { ownerProviderId: providerId, targetType, targetId, category, model, ...fields },
    });
  }

  // ── Vehicle owners ────────────────────────────────────────────────
  const saiTravels = await provider({
    type: "VEHICLE_OWNER", name: "Sri Sai Travels", phone: "9700100101",
    lat: L.nandyal.lat + 0.004, lng: L.nandyal.lng + 0.003, address: "Gandhi Nagar, Nandyal",
    radius: 25, rating: 4.8, jobs: 64, planCode: "PRO",
  });
  const innova = await prisma.vehicle.create({
    data: { providerId: saiTravels.id, category: "CAR", make: "Toyota", model: "Innova Crysta", title: "Toyota Innova Crysta", imageUrl: nextImage(), seats: 7, transmission: "MANUAL", fuelType: "DIESEL", ac: true, selfDriveAllowed: true, withDriverAllowed: true, status: "ACTIVE", year: 2022 },
  });
  const ertiga = await prisma.vehicle.create({
    data: { providerId: saiTravels.id, category: "CAR", make: "Maruti", model: "Ertiga", title: "Maruti Ertiga", imageUrl: nextImage(), seats: 7, transmission: "MANUAL", fuelType: "PETROL", ac: true, selfDriveAllowed: true, withDriverAllowed: true, status: "ACTIVE" },
  });
  await rule(saiTravels.id, "VEHICLE", innova.id, "CAR", "MIXED", { dailyRate: 2800, includedKmPerDay: 120, extraPerKm: 14, deposit: 2000, driverAllowanceDay: 500 });
  await rule(saiTravels.id, "VEHICLE", ertiga.id, "CAR", "MIXED", { dailyRate: 1700, includedKmPerDay: 120, extraPerKm: 11, deposit: 1500, driverAllowanceDay: 400 });

  const reddyRentals = await provider({
    type: "VEHICLE_OWNER", name: "Reddy Car Rentals", phone: "9700100102",
     lat: L.nandyal.lat - 0.01, lng: L.nandyal.lng + 0.02, address: "Kurnool road, Nandyal",
    radius: 30, rating: 4.6, jobs: 31,
  });
  const carens = await prisma.vehicle.create({
    data: { providerId: reddyRentals.id, category: "CAR", make: "Kia", model: "Carens", title: "Kia Carens", imageUrl: nextImage(), seats: 7, transmission: "MANUAL", fuelType: "DIESEL", ac: true, selfDriveAllowed: true, withDriverAllowed: true, status: "ACTIVE" },
  });
  const dzire = await prisma.vehicle.create({
    data: { providerId: reddyRentals.id, category: "CAR", make: "Maruti", model: "Swift Dzire", title: "Maruti Swift Dzire", imageUrl: nextImage(), seats: 5, transmission: "MANUAL", fuelType: "PETROL", ac: true, selfDriveAllowed: true, withDriverAllowed: true, status: "ACTIVE" },
  });
  await rule(reddyRentals.id, "VEHICLE", carens.id, "CAR", "MIXED", { dailyRate: 2400, includedKmPerDay: 120, extraPerKm: 13, deposit: 2000, driverAllowanceDay: 450 });
  await rule(reddyRentals.id, "VEHICLE", dzire.id, "CAR", "MIXED", { dailyRate: 1400, includedKmPerDay: 100, extraPerKm: 10, deposit: 1000, driverAllowanceDay: 350 });

  const balajiAutos = await provider({
    type: "VEHICLE_OWNER", name: "Balaji Autos", phone: "9700100103",
     lat: L.nandyal.lat - 0.002, lng: L.nandyal.lng + 0.001, address: "Nandyal bus stop",
    radius: 10, rating: 4.7, jobs: 88, responseSec: 30,
  });
  const auto1 = await prisma.vehicle.create({
    data: { providerId: balajiAutos.id, category: "AUTO", make: "Bajaj", model: "RE", title: "Bajaj RE Auto", imageUrl: nextImage(), seats: 3, fuelType: "CNG", withDriverAllowed: true, selfDriveAllowed: false, status: "ACTIVE" },
  });
  await prisma.vehicle.create({
    data: { providerId: balajiAutos.id, category: "AUTO", make: "Bajaj", model: "Maxima", title: "Bajaj Maxima Cargo Auto", imageUrl: nextImage(), seats: 3, fuelType: "DIESEL", withDriverAllowed: true, status: "ACTIVE" },
  });
  await rule(balajiAutos.id, "VEHICLE", null, "AUTO", "PER_KM", { perKm: 18, minCharge: 40, waitingChargePerHr: 40 });

  const kumarAuto = await provider({
    type: "VEHICLE_OWNER", name: "Kumar Auto", phone: "9700100104",
    lat: L.nandyal.lat - 0.01, lng: L.nandyal.lng + 0.02, address: "Old town, Nandyal",
    radius: 12, rating: 4.4, jobs: 52, planCode: "PRO",
  });
  const kumarAutoVeh = await prisma.vehicle.create({
    data: { providerId: kumarAuto.id, category: "AUTO", make: "TVS", model: "King", title: "TVS King Auto", imageUrl: nextImage(), seats: 3, fuelType: "PETROL", withDriverAllowed: true, status: "ACTIVE" },
  });
  await rule(kumarAuto.id, "VEHICLE", kumarAutoVeh.id, "AUTO", "PER_KM", { perKm: 15, minCharge: 35, waitingChargePerHr: 30 });

  const rkBikes = await provider({
    type: "VEHICLE_OWNER", name: "RK Bike Point", phone: "9700100105",
    lat: L.nandyal.lat + 0.008, lng: L.nandyal.lng - 0.006, address: "Railway station road, Nandyal",
    radius: 15, rating: 4.3, jobs: 40,
  });
  const bike = await prisma.vehicle.create({
    data: { providerId: rkBikes.id, category: "BIKE", make: "Honda", model: "Shine", title: "Honda Shine 125", imageUrl: nextImage(), seats: 2, fuelType: "PETROL", selfDriveAllowed: true, withDriverAllowed: false, status: "ACTIVE" },
  });
  const scooter = await prisma.vehicle.create({
    data: { providerId: rkBikes.id, category: "SCOOTER", make: "Honda", model: "Activa", title: "Honda Activa 6G", imageUrl: nextImage(), seats: 2, fuelType: "PETROL", selfDriveAllowed: true, withDriverAllowed: false, status: "ACTIVE" },
  });
  await rule(rkBikes.id, "VEHICLE", bike.id, "BIKE", "DAILY", { dailyRate: 350, includedKmPerDay: 80, extraPerKm: 3, deposit: 500 });
  await rule(rkBikes.id, "VEHICLE", scooter.id, "SCOOTER", "DAILY", { dailyRate: 400, includedKmPerDay: 80, extraPerKm: 3, deposit: 500 });

  const luxuryCabs = await provider({
    type: "VEHICLE_OWNER", name: "Nandyal Luxury Cabs", phone: "9700100106",
    lat: L.nandyal.lat + 0.015, lng: L.nandyal.lng + 0.012, address: "Kurnool road, Nandyal",
    radius: 40, rating: 4.9, jobs: 25, planCode: "BUSINESS",
  });
  const scorpio = await prisma.vehicle.create({
    data: { providerId: luxuryCabs.id, category: "SUV", make: "Mahindra", model: "Scorpio N", title: "Mahindra Scorpio N", imageUrl: nextImage(), seats: 7, fuelType: "DIESEL", ac: true, selfDriveAllowed: false, withDriverAllowed: true, status: "ACTIVE" },
  });
  const xylo = await prisma.vehicle.create({
    data: { providerId: luxuryCabs.id, category: "SUV", make: "Mahindra", model: "Xylo", title: "Mahindra Xylo D2", imageUrl: nextImage(), seats: 7, fuelType: "DIESEL", ac: true, selfDriveAllowed: true, withDriverAllowed: true, status: "ACTIVE" },
  });
  await rule(luxuryCabs.id, "VEHICLE", scorpio.id, "SUV", "PER_KM", { perKm: 24, minCharge: 600, driverAllowanceDay: 600 });
  await rule(luxuryCabs.id, "VEHICLE", xylo.id, "SUV", "MIXED", { dailyRate: 1600, includedKmPerDay: 100, extraPerKm: 12, deposit: 1000, driverAllowanceDay: 400 });

  const kurnoolVans = await provider({
    type: "VEHICLE_OWNER", name: "Kurnool Van & Pickup", phone: "9700100107",
    lat: L.kurnool.lat, lng: L.kurnool.lng, address: "B Camp, Kurnool",
    radius: 50, rating: 4.5, jobs: 22,
  });
  const van = await prisma.vehicle.create({
    data: { providerId: kurnoolVans.id, category: "VAN", make: "Force", model: "Traveller", title: "Force Traveller 12-seat", imageUrl: nextImage(), seats: 12, fuelType: "DIESEL", ac: true, withDriverAllowed: true, status: "ACTIVE" },
  });
  const pickup = await prisma.vehicle.create({
    data: { providerId: kurnoolVans.id, category: "PICKUP", make: "Mahindra", model: "Bolero Pikup", title: "Bolero Pickup 1.5T", imageUrl: nextImage(), seats: 2, loadCapacityTons: 1.5, withDriverAllowed: true, status: "ACTIVE" },
  });
  await rule(kurnoolVans.id, "VEHICLE", van.id, "VAN", "PER_KM", { perKm: 26, minCharge: 900, driverAllowanceDay: 500 });
  await rule(kurnoolVans.id, "VEHICLE", pickup.id, "PICKUP", "PER_TRIP", { perTrip: 1800, perKm: 18, minCharge: 800 });

  const apRoadlines = await provider({
     type: "VEHICLE_OWNER", name: "National Roadlines", phone: "9700100108",
    lat: L.nh40point.lat, lng: L.nh40point.lng, address: "NH-40 bypass point",
    radius: 60, rating: 4.1, jobs: 33, availability: "OFFLINE",
  });
  const truck = await prisma.vehicle.create({
    data: { providerId: apRoadlines.id, category: "TRUCK", make: "Tata", model: "LPK 1109", title: "Tata LPK 1109 (6-wheel)", imageUrl: nextImage(), seats: 2, loadCapacityTons: 9, withDriverAllowed: true, status: "ACTIVE" },
  });
  await prisma.vehicle.create({
    data: { providerId: apRoadlines.id, category: "BUS", make: "Eicher", model: "Starline 32", title: "Eicher Starline 32-seat", imageUrl: nextImage(), seats: 32, withDriverAllowed: true, status: "ACTIVE" },
  });
  await rule(apRoadlines.id, "VEHICLE", truck.id, "TRUCK", "PER_KM", { perKm: 42, minCharge: 2500, driverAllowanceDay: 700 });

  // ── Drivers ───────────────────────────────────────────────────────
  const ravi = await provider({
    type: "DRIVER", name: "Ravi", phone: "9700200101",
     lat: L.nandyal.lat + 0.001, lng: L.nandyal.lng - 0.002, address: "Nandyal village",
    radius: 25, rating: 4.9, jobs: 71, responseSec: 25,
  });
  const raviProfile = await prisma.driverProfile.create({
    data: { providerId: ravi.id, experienceYears: 12, licenseType: "LMV_TR", hasOwnVehicle: false, languages: JSON.stringify(["Telugu", "Hindi"]), driveCategories: JSON.stringify(["CAR", "SUV", "VAN"]) },
  });
  await rule(ravi.id, "DRIVER", raviProfile.id, null, "DAILY", { dailyRate: 900, hourlyRate: 130 });

  const suresh = await provider({
    type: "DRIVER", name: "Suresh", phone: "9700200102",
    lat: L.nandyal.lat - 0.006, lng: L.nandyal.lng - 0.004, address: "Chandrasekharapuram, Nandyal",
    radius: 40, rating: 4.7, jobs: 44,
  });
  const sureshProfile = await prisma.driverProfile.create({
    data: { providerId: suresh.id, experienceYears: 8, licenseType: "HMV", hasOwnVehicle: false, languages: JSON.stringify(["Telugu"]), driveCategories: JSON.stringify(["TRUCK", "BUS", "PICKUP"]) },
  });
  await rule(suresh.id, "DRIVER", sureshProfile.id, null, "DAILY", { dailyRate: 1100, hourlyRate: 160 });

  const anand = await provider({
    type: "DRIVER", name: "Anand", phone: "9700200103",
    lat: L.kurnool.lat + 0.005, lng: L.kurnool.lng + 0.005, address: "Kallur Estate, Kurnool",
    radius: 30, rating: 4.5, jobs: 19, autoAccept: false,
  });
  const anandProfile = await prisma.driverProfile.create({
    data: { providerId: anand.id, experienceYears: 5, licenseType: "LMV", hasOwnVehicle: false, languages: JSON.stringify(["Telugu", "Kannada"]), driveCategories: JSON.stringify(["CAR"]) },
  });
  await rule(anand.id, "DRIVER", anandProfile.id, null, "DAILY", { dailyRate: 850, hourlyRate: 120 });

  const mahesh = await provider({
    type: "DRIVER", name: "Mahesh (auto driver)", phone: "9700200104",
    lat: L.nandyal.lat + 0.02, lng: L.nandyal.lng - 0.01, address: "Nandyal centre",
    radius: 12, rating: 4.6, jobs: 96,
  });
  const maheshProfile = await prisma.driverProfile.create({
    data: { providerId: mahesh.id, experienceYears: 9, licenseType: "AUTO_RICKSHAW", hasOwnVehicle: true, languages: JSON.stringify(["Telugu"]), driveCategories: JSON.stringify(["AUTO"]) },
  });
  await rule(mahesh.id, "DRIVER", maheshProfile.id, null, "HOURLY", { hourlyRate: 90 });

  // ── Garages / roadside ────────────────────────────────────────────
  const lakshmiGarage = await provider({
    type: "GARAGE", name: "Sri Lakshmi Garage", phone: "9700300101",
    lat: L.nandyal.lat - 0.012, lng: L.nandyal.lng + 0.008, address: "Gooty road, Nandyal",
    radius: 20, rating: 4.6, jobs: 120,
  });
  await prisma.garageProfile.create({
    data: { providerId: lakshmiGarage.id, services: JSON.stringify(["MECHANIC", "ELECTRICAL", "AC_REPAIR", "WATER_SERVICE"]), open24x7: false, opensAt: "08:00", closesAt: "21:00", pickupDrop: true },
  });
  await rule(lakshmiGarage.id, "GARAGE_SERVICE", null, null, "PER_VISIT", { visitCharge: 300, minCharge: 300 });

  const highwayTowing = await provider({
    type: "GARAGE", name: "Highway Towing & Repair", phone: "9700300102",
    lat: L.nh40point.lat + 0.003, lng: L.nh40point.lng - 0.002, address: "NH-40 near forest turn",
    radius: 80, rating: 4.7, jobs: 87, responseSec: 20,
  });
  await prisma.garageProfile.create({
    data: { providerId: highwayTowing.id, services: JSON.stringify(["TOWING", "BREAKDOWN", "MECHANIC"]), open24x7: true, pickupDrop: true },
  });
  await rule(highwayTowing.id, "GARAGE_SERVICE", null, "TOWING", "MIXED", { visitCharge: 1000, perKm: 80, minCharge: 1200 });
  await rule(highwayTowing.id, "GARAGE_SERVICE", null, "MECHANIC", "PER_VISIT", { visitCharge: 450 });

  const batteryPoint = await provider({
    type: "GARAGE", name: "BatteryPoint 24×7", phone: "9700300103",
    lat: L.nandyal.lat + 0.005, lng: L.nandyal.lng + 0.018, address: "Bank colony, Nandyal",
    radius: 30, rating: 4.5, jobs: 63,
  });
  await prisma.garageProfile.create({
    data: { providerId: batteryPoint.id, services: JSON.stringify(["BATTERY", "TYRE", "ELECTRICAL"]), open24x7: true },
  });
  await rule(batteryPoint.id, "GARAGE_SERVICE", null, null, "PER_VISIT", { visitCharge: 250, travelCharge: 100 });

  const villageTyre = await provider({
    type: "GARAGE", name: "Nandyal Tyre Works", phone: "9700300104",
     lat: L.nandyal.lat + 0.003, lng: L.nandyal.lng + 0.004, address: "Main road, Nandyal",
    radius: 15, rating: 4.3, jobs: 41, autoAccept: false,
  });
  await prisma.garageProfile.create({
    data: { providerId: villageTyre.id, services: JSON.stringify(["TYRE", "BREAKDOWN", "MECHANIC"]), open24x7: true },
  });
  await rule(villageTyre.id, "GARAGE_SERVICE", null, null, "PER_VISIT", { visitCharge: 200 });

  // ── Farm equipment ────────────────────────────────────────────────
  const venkatramaAgri = await provider({
    type: "FARM", name: "Venkatrama Agri Services", phone: "9700400101",
     lat: L.nandyal.lat - 0.004, lng: L.nandyal.lng - 0.001, address: "Nandyal agriculture lane",
    radius: 25, rating: 4.8, jobs: 54, planCode: "PRO",
  });
  const tractor = await prisma.farmEquipment.create({
    data: { providerId: venkatramaAgri.id, equipmentType: "TRACTOR", title: "John Deere 5310 Tractor", capacityAcresPerDay: 12, hp: 55, attachments: JSON.stringify(["ROTAVATOR", "CULTIVATOR", "TRAILER"]), status: "ACTIVE" },
  });
  await prisma.farmEquipment.create({
    data: { providerId: venkatramaAgri.id, equipmentType: "TRACTOR_TRAILER", title: "Tractor + Tipping Trailer", capacityAcresPerDay: null, hp: 47, attachments: JSON.stringify([]), status: "ACTIVE" },
  });
  await rule(venkatramaAgri.id, "FARM_EQUIPMENT", tractor.id, null, "PER_ACRE", { perAcre: 800, minAcres: 2, travelCharge: 200 });
  const vt = await prisma.farmEquipment.findFirst({ where: { providerId: venkatramaAgri.id, equipmentType: "TRACTOR_TRAILER" } });
  await rule(venkatramaAgri.id, "FARM_EQUIPMENT", vt.id, null, "PER_DAY", { dailyRate: 2200 });

  const greenFields = await provider({
    type: "FARM", name: "Green Fields Farm Equipment", phone: "9700400102",
    lat: L.allagadda.lat, lng: L.allagadda.lng, address: "Allagadda highway yard",
    radius: 45, rating: 4.6, jobs: 37,
  });
  const harvester = await prisma.farmEquipment.create({
    data: { providerId: greenFields.id, equipmentType: "HARVESTER", title: "Combine Harvester", capacityAcresPerDay: 30, attachments: JSON.stringify(["PADDY", "MAIZE"]), status: "ACTIVE" },
  });
  await prisma.farmEquipment.create({
    data: { providerId: greenFields.id, equipmentType: "WATER_TANKER", title: "Water Tanker 5000L", status: "ACTIVE" },
  });
  await rule(greenFields.id, "FARM_EQUIPMENT", harvester.id, null, "PER_ACRE", { perAcre: 1500, minAcres: 3, travelCharge: 500 });
  const tanker = await prisma.farmEquipment.findFirst({ where: { providerId: greenFields.id, equipmentType: "WATER_TANKER" } });
  await rule(greenFields.id, "FARM_EQUIPMENT", tanker.id, null, "PER_TRIP", { perTrip: 500, perKm: 12 });

  // ── Drone operators ───────────────────────────────────────────────
  const skyAgri = await provider({
    type: "DRONE", name: "SkyAgri Drone Spraying", phone: "9700500101",
    lat: L.nandyal.lat + 0.03, lng: L.nandyal.lng + 0.02, address: "Industrial area, Nandyal",
    radius: 60, rating: 4.8, jobs: 29, planCode: "PRO",
  });
  await prisma.droneProfile.create({
    data: { providerId: skyAgri.id, dronesCount: 3, acresPerDay: 60, sprayTypes: JSON.stringify(["PESTICIDE", "FUNGICIDE", "NUTRIENT"]), certificateNo: "DGCA-NW-2024-118" },
  });
  await rule(skyAgri.id, "DRONE_SERVICE", null, null, "PER_ACRE", { perAcre: 400, minAcres: 3, travelCharge: 500 });

  const droneKisan = await provider({
    type: "DRONE", name: "DroneKisan Services", phone: "9700500102",
    lat: L.kurnool.lat - 0.01, lng: L.kurnool.lng + 0.01, address: "Kurnool outskirts",
    radius: 70, rating: 4.6, jobs: 17, autoAccept: false,
  });
  await prisma.droneProfile.create({
    data: { providerId: droneKisan.id, dronesCount: 2, acresPerDay: 35, sprayTypes: JSON.stringify(["PESTICIDE", "NUTRIENT"]) },
  });
  await rule(droneKisan.id, "DRONE_SERVICE", null, null, "PER_ACRE", { perAcre: 450, minAcres: 2, travelCharge: 300 });

  // ── Demo customer history (for Book Again / favorites) ───────────
  const pastBooking = await prisma.booking.create({
    data: {
      code: "NW-PAST01",
      customerId: demoCustomer.id,
      providerId: ravi.id,
      kind: "DRIVER",
      listingKind: "DRIVER",
      listingId: raviProfile.id,
      listingTitle: "Ravi (driver)",
      providerName: "Ravi",
      status: "COMPLETED",
      paymentStatus: "PAID",
      scheduledFor: new Date(Date.now() - 6 * 24 * 3600_000),
      durationDays: 1,
      totalAmount: 900,
      baseAmount: 900,
      commissionAmount: 90,
      idempotencyKey: "seed-past-booking-1",
      priceBreakdownJson: JSON.stringify([{ label: "Full day × 1", amount: 900 }]),
    },
  });
  await prisma.review.create({
    data: { bookingId: pastBooking.id, customerId: demoCustomer.id, providerId: ravi.id, rating: 5, comment: "Very careful driving on ghat road." },
  });
  await prisma.favorite.create({
    data: { customerId: demoCustomer.id, providerId: ravi.id, label: "My driver" },
  });
  await prisma.notification.create({
    data: { userId: demoCustomer.id, title: "Welcome to Near Wheels 🎉", body: "Tell us what you need and we'll find it near you.", kind: "INFO" },
  });

  console.log("Seed complete:");
  console.log(`  locations: ${await prisma.location.count()}`);
  console.log(`  providers: ${await prisma.provider.count()}`);
  console.log(`  vehicles: ${await prisma.vehicle.count()}`);
  console.log(`  pricingRules: ${await prisma.pricingRule.count()}`);
  console.log(`  admin login phone: ${adminPhone}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
