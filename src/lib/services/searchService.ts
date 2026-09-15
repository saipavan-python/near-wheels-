import { prisma } from "../db";
import { getSettings } from "../config";
import { roadDistanceKm, etaMinutes, nextRadius } from "../geo";
import { resolveLocation } from "./locationService";
import { isAvailableNow, listActiveAvailabilitiesForVehicles, listActiveDriverAvailabilities, isRangeBlockedByAvailabilities, isDateBlockedByAvailabilities, startOfDay, endOfDay } from "./availabilityService";
import { minVisiblePrice } from "./pricingService";
import { trustBadges } from "./qualityService";
import type { SearchFilters, SearchResult, ResultCard } from "../types";
import { parse, inr } from "../utils";
import type {
  Provider,
  Vehicle,
  DriverProfile,
  GarageProfile,
  FarmEquipment,
  DroneProfile,
  PricingRule,
} from "@prisma/client";

function getRequestedDateRange(f: SearchFilters): { start: Date; end: Date } | null {
  const pick = f.scheduledFor || f.date || f.startDate;
  if (pick) {
    const start = new Date(pick);
    if (isNaN(start.getTime())) return null;
    let end: Date;
    if (f.endDate) {
      end = new Date(f.endDate);
      if (isNaN(end.getTime())) end = new Date(start);
    } else if (f.durationDays && f.durationDays > 1) {
      end = new Date(start);
      end.setDate(end.getDate() + f.durationDays - 1);
    } else {
      end = new Date(start);
    }
    return { start: startOfDay(start), end: endOfDay(end) };
  }
  if (f.durationDays && f.durationDays > 0) {
    // duration without date means today + duration
    const today = startOfDay(new Date());
    const end = new Date(today);
    end.setDate(end.getDate() + f.durationDays - 1);
    return { start: today, end: endOfDay(end) };
  }
  return null;
}

export class AmbiguousLocationError extends Error {
  candidates: { id: string; name: string; label: string; lat: number; lng: number }[];
  constructor(candidates: { id: string; name: string; label: string; lat: number; lng: number }[]) {
    super("Multiple possible locations");
    this.candidates = candidates;
  }
}

export class NoLocationError extends Error {}

interface Center {
  lat: number;
  lng: number;
  label: string;
}

async function resolveCenter(f: SearchFilters): Promise<Center> {
  if (f.lat != null && f.lng != null) return { lat: f.lat, lng: f.lng, label: f.locationText || "your location" };
  const r = await resolveLocation(f.locationText);
  if (r.resolved) {
    return { lat: r.resolved.lat, lng: r.resolved.lng, label: r.resolved.name };
  }
  if (r.ambiguous && r.candidates.length) {
    throw new AmbiguousLocationError(
      r.candidates.map((c) => ({
        id: c.id,
        name: c.name,
        label: [c.name, c.type, c.district].filter(Boolean).join(", "),
        lat: c.lat,
        lng: c.lng,
      }))
    );
  }
  throw new NoLocationError(`I couldn't find "${f.locationText || "that place"}". Which location should I search near?`);
}

function needMatchVehicle(v: Vehicle, f: SearchFilters): number {
  if (f.model) {
    const m = f.model.toLowerCase();
    const hay = `${v.make} ${v.model} ${v.title}`.toLowerCase();
    if (hay.includes(m)) return 1;
  }
  if (f.category && v.category === f.category) return 0.85;
  // SUVs commonly searched as "car" family
  if (f.category === "CAR" && ["SUV"].includes(v.category)) return 0.7;
  return 0.45;
}

function vehicleCard(
  v: Vehicle & { provider: Provider },
  distanceKm: number | null,
  rule: PricingRule | null,
  availableNow: boolean,
  reason?: string
): ResultCard {
  const priceFrom = minVisiblePrice(rule);
  const mode =
    v.selfDriveAllowed && v.withDriverAllowed
      ? "Self-drive or with driver"
      : v.selfDriveAllowed
      ? "Self-drive"
      : "With driver";
  return {
    kind: "VEHICLE",
    id: v.id,
    providerId: v.providerId,
    title: v.title || `${v.make} ${v.model}`,
    subtitle: `${v.seats} seats${v.ac ? " • AC" : ""} • ${mode}`,
    category: v.category,
    distanceKm,
    etaMin: distanceKm != null ? etaMinutes(distanceKm) : null,
    availableNow,
    priceLabel:
      priceFrom != null
        ? `from ${inr(priceFrom)}${rule?.model === "PER_KM" ? "/km" : "/day"}`
        : "price on request",
    priceFrom,
    rating: v.provider.ratingAvg,
    verified: v.provider.isVerified,
    badges: trustBadges(v.provider),
    reason,
    emoji:
      v.category === "AUTO" ? "" :
      v.category === "BIKE" ? "" :
      v.category === "SCOOTER" ? "" :
      ["TRUCK", "PICKUP"].includes(v.category) ? "" :
      v.category === "BUS" ? "" :
      v.category === "VAN" ? "" :
      v.category === "TRACTOR" ? "" : "",
    imageUrl: v.imageUrl || undefined,
    meta: {
      model: v.model,
      make: v.make,
      seats: v.seats,
      ac: !!v.ac,
      transmission: v.transmission,
      fuelType: v.fuelType,
      selfDrive: v.selfDriveAllowed,
      withDriver: v.withDriverAllowed,
      loadTons: v.loadCapacityTons ?? null,
    },
  };
}

async function ladderRadii(requested?: number): Promise<number[]> {
  const s = await getSettings();
  const start = Math.min(requested ?? s.immediateSearchRadiusKm, s.maxSearchRadiusKm);
  const ladder = [start];
  let cur = start;
  while (cur < s.maxSearchRadiusKm) {
    const n = nextRadius(cur);
    if (!n) break;
    ladder.push(n);
    cur = n;
  }
  return ladder;
}

// ── Vehicles ──────────────────────────────────────────────────────────

export async function searchVehicles(f: SearchFilters): Promise<SearchResult> {
  const center = await resolveCenter(f);
  const settings = await getSettings();
  const radii = await ladderRadii(f.radiusKm);
  const maxR = radii[radii.length - 1] ?? settings.maxSearchRadiusKm;
  // Performance: geo bounding box to avoid loading all vehicles (scale: O(N) -> O(filtered))
  const latDelta = maxR / 111;
  const lngDelta = maxR / (111 * Math.max(0.2, Math.cos((center.lat * Math.PI) / 180)));
  const minLat = center.lat - latDelta;
  const maxLat = center.lat + latDelta;
  const minLng = center.lng - lngDelta;
  const maxLng = center.lng + lngDelta;

  const vehicles = await prisma.vehicle.findMany({
    where: {
      status: "ACTIVE",
      provider: {
        lat: { gte: minLat, lte: maxLat },
        lng: { gte: minLng, lte: maxLng },
        status: "ACTIVE",
      },
    },
    include: { provider: true },
  });

  let candidates = vehicles.filter((v) => {
    const p = v.provider;
    if (p.status !== "ACTIVE") return false;
    if (!p.lat || !p.lng) return false;
    if (f.rentalMode === "SELF_DRIVE" && !v.selfDriveAllowed) return false;
    if (f.rentalMode === "WITH_DRIVER" && !v.withDriverAllowed) return false;
    if (f.seats && v.seats < f.seats) return false;
    if (f.ac === true && !v.ac) return false;
    if (f.ac === false && v.ac === true) return false; // explicit non-AC ask only
    if (f.loadTons && v.loadCapacityTons && v.loadCapacityTons < f.loadTons) return false;
    if (f.model) return true; // keep all for exact-first ranking across radii
    if (f.category) return v.category === f.category || needMatchVehicle(v, { ...f }) >= 0.7;
    return true;
  });

  // Exact-model-first search (spec §14): find exact matches at any radius first.
  const exact = f.model
    ? candidates.filter((v) =>
        `${v.make} ${v.model}`.toLowerCase().includes(f.model!.toLowerCase()))
    : [];

  const withDist = candidates.map((v) => ({
    v,
    d: roadDistanceKm(center.lat, center.lng, v.provider.lat, v.provider.lng),
  }));

  let chosen: { v: Vehicle & { provider: Provider }; d: number }[] = [];
  let usedRadius = radii[0];
  for (const radius of radii) {
    usedRadius = radius;
    const inR = withDist.filter((x) => x.d <= radius);
    if (exact.length) {
      // Exact model always ranks ahead of alternatives (spec §21),
      // distance-ordered within each group.
      const inExact = inR
        .filter((x) => exact.some((e) => e.id === x.v.id))
        .sort((a, b) => a.d - b.d);
      const inRest = inR
        .filter((x) => !exact.some((e) => e.id === x.v.id))
        .sort((a, b) => a.d - b.d);
      chosen = [...inExact, ...inRest].slice(0, 8);
    } else {
      chosen = [...inR].sort((a, b) => a.d - b.d).slice(0, 8);
    }
    if (chosen.length >= 5 && (exact.length > 0 || !f.model)) break;
    if (radius >= settings.maxSearchRadiusKm) break;
  }

  const scheduledFor = f.scheduledFor ? new Date(f.scheduledFor) : f.date ? new Date(f.date) : f.startDate ? new Date(f.startDate) : null;
  const requestedRange = getRequestedDateRange(f);
  // Batch fetch vehicle availabilities for date filtering
  const vehicleIds = chosen.map((c) => c.v.id);
  const availabilityMap = await listActiveAvailabilitiesForVehicles(vehicleIds);

  // Batch fetch booking conflicts for requested range (if date provided)
  let bookedVehicleIds = new Set<string>();
  if (requestedRange) {
    // Check bookings overlapping the requested date/range
    const rangeStart = requestedRange.start;
    const rangeEnd = requestedRange.end;
    // Use expanded window: bookings where scheduledFor within [rangeStart -24h, rangeEnd +24h]
    const from = new Date(rangeStart.getTime() - 24 * 3600_000);
    const to = new Date(rangeEnd.getTime() + 24 * 3600_000);
    const conflicts = await prisma.booking.findMany({
      where: {
        listingKind: "VEHICLE",
        listingId: { in: vehicleIds },
        status: { in: ["REQUESTED", "PENDING_PROVIDER", "ACCEPTED", "CONFIRMED", "EN_ROUTE", "IN_PROGRESS"] },
        scheduledFor: { gte: from, lte: to },
      },
      select: { listingId: true },
    });
    bookedVehicleIds = new Set(conflicts.map((c) => c.listingId));
    // Also immediate holds block today if no date
  } else {
    const immediateHolds = await prisma.booking.findMany({
      where: {
        listingKind: "VEHICLE",
        listingId: { in: vehicleIds },
        scheduledFor: null,
        status: { in: ["REQUESTED", "PENDING_PROVIDER", "ACCEPTED", "CONFIRMED", "EN_ROUTE", "IN_PROGRESS"] },
        OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: new Date() } }],
      },
      select: { listingId: true },
    });
    bookedVehicleIds = new Set(immediateHolds.map((c) => c.listingId));
  }

  const rulesByProvider = new Map<string, PricingRule>();
  const rules = await prisma.pricingRule.findMany({
    where: { ownerProviderId: { in: chosen.map((c) => c.v.providerId) }, active: true },
  });
  for (const r of rules) {
    if (!rulesByProvider.has(`${r.ownerProviderId}:${r.targetId || ""}`)) {
      rulesByProvider.set(`${r.ownerProviderId}:${r.targetId || ""}`, r);
    }
  }

  const items: ResultCard[] = [];
  for (const { v, d } of chosen) {
    // ── Permanent status check ──────────────────────────────────────
    if (v.status !== "ACTIVE") continue;

    // ── Provider availability ───────────────────────────────────────
    let ok = true;
    if (requestedRange || scheduledFor) {
      ok = v.provider.status === "ACTIVE" && v.provider.availabilityStatus !== "OFFLINE";
    } else {
      ok = isAvailableNow(v.provider);
    }
    if (!ok) continue;

    // ── Date-based vehicle availability (VehicleAvailability table) ──
    const avails = availabilityMap.get(v.id) || [];
    let blocked = false;
    if (requestedRange) {
      blocked = isRangeBlockedByAvailabilities(avails, requestedRange.start, requestedRange.end);
    } else {
      // No date requested → check today
      blocked = isDateBlockedByAvailabilities(avails, new Date());
    }
    if (blocked) continue;

    // ── Booking conflict (double-booking protection) ─────────────────
    if (bookedVehicleIds.has(v.id)) continue;

    const rule =
      rules.find((r) => r.ownerProviderId === v.providerId && r.targetId === v.id) ||
      rules.find((r) => r.ownerProviderId === v.providerId && r.targetType === "VEHICLE" && r.category === v.category) ||
      rules.find((r) => r.ownerProviderId === v.providerId && r.targetType === "VEHICLE") ||
      null;

    const isExact = f.model ? `${v.make} ${v.model}`.toLowerCase().includes(f.model.toLowerCase()) : false;
    const reason = isExact
      ? "Exact model you asked for"
      : d <= 3
      ? "Very close to you"
      : undefined;

    items.push(vehicleCard(v, d, rule, !scheduledFor, reason));
  }

  const exactMatchFound = items.some((i) => f.model && i.meta.model && String(i.meta.model).toLowerCase().includes(f.model.toLowerCase()));
  const sortedItems = sortByPriority(items, f.sortBy);
  return {
    querySummary: summaryFor(f),
    exactMatchFound,
    showingAlternatives: !!f.model && !exactMatchFound,
    searchedRadiusKm: usedRadius,
    items: sortedItems,
  };
}

function sortByPriority(items: ResultCard[], sortBy?: string): ResultCard[] {
  if (!sortBy || sortBy === "BEST_MATCH") return items;
  const arr = [...items];
  switch (sortBy) {
    case "NEAREST":
      return arr.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    case "CHEAPEST":
      return arr.sort((a, b) => (a.priceFrom ?? Infinity) - (b.priceFrom ?? Infinity));
    case "BEST_RATED":
      return arr.sort((a, b) => b.rating - a.rating);
    case "FASTEST":
      return arr.sort((a, b) => Number(b.availableNow) - Number(a.availableNow) || (a.etaMin ?? 999) - (b.etaMin ?? 999));
    default:
      return arr;
  }
}

// ── Drivers ───────────────────────────────────────────────────────────

function drivesMatches(categories: string[], f: SearchFilters): boolean {
  if (!f.category) return true;
  if (categories.includes(f.category)) return true;
  // Family matching: "car" covers SUVs, and vice-versa
  if (f.category === "CAR" && categories.includes("SUV")) return true;
  if (f.category === "SUV" && categories.includes("CAR")) return true;
  return false;
}

export async function searchDrivers(f: SearchFilters): Promise<SearchResult> {
  const center = await resolveCenter(f);
  const settings = await getSettings();
  const radii = await ladderRadii(f.radiusKm);
  const maxR = radii[radii.length - 1] ?? settings.maxSearchRadiusKm;

  // Geo bounding box to bound the query (same approach as vehicles)
  const latDelta = maxR / 111;
  const lngDelta = maxR / (111 * Math.max(0.2, Math.cos((center.lat * Math.PI) / 180)));
  const box = {
    lat: { gte: center.lat - latDelta, lte: center.lat + latDelta },
    lng: { gte: center.lng - lngDelta, lte: center.lng + lngDelta },
  };

  const providers = await prisma.provider.findMany({
    where: { status: "ACTIVE", ...box },
    include: {
      driverProfile: true,
      drivers: { where: { status: "ACTIVE" } },
    },
  });

  const scheduledFor = f.scheduledFor ? new Date(f.scheduledFor) : f.date ? new Date(f.date) : f.startDate ? new Date(f.startDate) : null;
  const requestedRange = getRequestedDateRange(f);

  // Distance-ladder selection of candidate providers
  const scored = providers.map((p) => ({ p, d: roadDistanceKm(center.lat, center.lng, p.lat!, p.lng!) }));
  let chosen = scored;
  let usedRadius = radii[0];
  for (const radius of radii) {
    usedRadius = radius;
    chosen = scored.filter((x) => x.d <= radius).sort((a, b) => a.d - b.d);
    if (chosen.length >= 8) break;
    if (radius >= settings.maxSearchRadiusKm) break;
  }

  const rosterIds = chosen.flatMap((c) => c.p.drivers.map((dr) => dr.id));

  // Batch availability + booking conflicts for roster drivers
  const availabilityMap = await listActiveDriverAvailabilities(rosterIds);
  let bookedDriverIds = new Set<string>();
  if (rosterIds.length) {
    if (requestedRange) {
      const from = new Date(requestedRange.start.getTime() - 24 * 3600_000);
      const to = new Date(requestedRange.end.getTime() + 24 * 3600_000);
      const conflicts = await prisma.booking.findMany({
        where: {
          listingKind: "DRIVER",
          listingId: { in: rosterIds },
          status: { in: ["REQUESTED", "PENDING_PROVIDER", "ACCEPTED", "CONFIRMED", "EN_ROUTE", "IN_PROGRESS"] },
          scheduledFor: { gte: from, lte: to },
        },
        select: { listingId: true },
      });
      bookedDriverIds = new Set(conflicts.map((c) => c.listingId));
    } else {
      const immediateHolds = await prisma.booking.findMany({
        where: {
          listingKind: "DRIVER",
          listingId: { in: rosterIds },
          scheduledFor: null,
          status: { in: ["REQUESTED", "PENDING_PROVIDER", "ACCEPTED", "CONFIRMED", "EN_ROUTE", "IN_PROGRESS"] },
          OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: new Date() } }],
        },
        select: { listingId: true },
      });
      bookedDriverIds = new Set(immediateHolds.map((c) => c.listingId));
    }
  }

  const providerIds = chosen.map((c) => c.p.id);
  const rules = await prisma.pricingRule.findMany({
    where: { ownerProviderId: { in: providerIds }, active: true },
  });

  const items: ResultCard[] = [];

  for (const { p, d } of chosen) {
    // Provider-level availability gate
    const providerOk = requestedRange || scheduledFor
      ? p.availabilityStatus !== "OFFLINE"
      : isAvailableNow(p);
    if (!providerOk) continue;

    // ── Provider-as-driver (DriverProfile, legacy) ───────────────────
    const profile = p.driverProfile;
    if (profile) {
      let cats: string[] = [];
      try { cats = parse(profile.driveCategories, []); } catch {}
      if (!drivesMatches(cats, f)) continue;
      const rule =
        rules.find((r) => r.ownerProviderId === p.id && r.targetId === profile.id) ||
        rules.find((r) => r.ownerProviderId === p.id && r.targetType === "DRIVER") ||
        null;
      const priceFrom = minVisiblePrice(rule);
      const languages: string[] = parse(profile.languages, []);
      items.push({
        kind: "DRIVER",
        id: profile.id,
        providerId: p.id,
        title: p.businessName,
        subtitle: `${profile!.experienceYears}+ yrs experience${languages.length ? ` • ${languages.join(", ")}` : ""}`,
        category: "DRIVER",
        distanceKm: d,
        etaMin: etaMinutes(d),
        availableNow: !scheduledFor,
        priceLabel: priceFrom != null ? `from ${inr(priceFrom)}/day` : "price on request",
        priceFrom,
        rating: p.ratingAvg,
        verified: p.isVerified,
        badges: trustBadges(p),
        emoji: "",
        reason: d <= 3 ? "Nearby and experienced" : undefined,
        imageUrl: "/images/driver-profile.jpg",
        meta: {
          experienceYears: profile!.experienceYears,
          licenseType: profile!.licenseType,
          hasOwnVehicle: profile!.hasOwnVehicle,
          languages: languages.join(", "),
          drives: cats.join(", "),
        },
      });
    }

    // ── Roster drivers (provider-owned) ──────────────────────────────
    for (const driver of p.drivers) {
      let cats: string[] = [];
      try { cats = parse(driver.categoriesJson, []); } catch {}
      if (!drivesMatches(cats, f)) continue;

      // Per-driver date blocks (DriverAvailability) — like vehicles
      const avails = availabilityMap.get(driver.id) || [];
      let blocked = false;
      if (requestedRange) {
        blocked = isRangeBlockedByAvailabilities(avails, requestedRange.start, requestedRange.end);
      } else {
        blocked = isDateBlockedByAvailabilities(avails, new Date());
      }
      if (blocked) continue;

      // Booking conflict (double-booking protection)
      if (bookedDriverIds.has(driver.id)) continue;

      const rule =
        rules.find((r) => r.ownerProviderId === p.id && r.targetId === driver.id) ||
        rules.find((r) => r.ownerProviderId === p.id && r.targetType === "DRIVER") ||
        null;
      const priceFrom = minVisiblePrice(rule);
      const languages: string[] = parse(driver.languagesJson, []);
      const drivesLabel = cats.length ? cats.join(", ").toLowerCase() : "car & auto";

      items.push({
        kind: "DRIVER",
        id: driver.id,
        providerId: p.id,
        title: driver.name || p.businessName,
        subtitle: `Drives ${drivesLabel}${languages.length ? ` • ${languages.join(", ")}` : ""}`,
        category: "DRIVER",
        distanceKm: d,
        etaMin: etaMinutes(d),
        availableNow: !scheduledFor,
        priceLabel: priceFrom != null ? `from ${inr(priceFrom)}/day` : "price on request",
        priceFrom,
        rating: p.ratingAvg,
        verified: p.isVerified,
        badges: trustBadges(p),
        emoji: "",
        reason: d <= 3 ? "Nearby driver" : undefined,
        imageUrl: "/images/driver-profile.jpg",
        meta: {
          experienceYears: driver.experienceYears,
          licenseType: driver.licenseType,
          languages: languages.join(", "),
          drives: cats.join(", "),
        },
      });
    }
  }

  return {
    querySummary: `Drivers near ${center.label}`,
    exactMatchFound: items.length > 0,
    showingAlternatives: false,
    searchedRadiusKm: usedRadius,
    items: sortByPriority(items, f.sortBy),
  };
}

// ── Garages / roadside ────────────────────────────────────────────────

export async function searchGarages(f: SearchFilters): Promise<SearchResult> {
  const center = await resolveCenter(f);
  const settings = await getSettings();

  const garages = await prisma.provider.findMany({
    where: { type: "GARAGE", status: "ACTIVE" },
    include: { garageProfile: true },
  });

  const wanted = f.serviceTypes && f.serviceTypes.length ? f.serviceTypes : null;
  const scored = garages
    .map((p) => ({ p, d: roadDistanceKm(center.lat, center.lng, p.lat, p.lng), profile: p.garageProfile }))
    .filter((x) => x.profile)
    .filter((x) => {
      if (!wanted) return true;
      const services: string[] = parse(x.profile!.services, []);
      return wanted.some((s) => services.includes(s));
    })
    .sort((a, b) => a.d - b.d);

  const emergency = f.serviceTypes?.some((s) => ["BREAKDOWN", "TOWING", "BATTERY", "TYRE", "MECHANIC"].includes(s));
  const maxR = emergency ? settings.maxSearchRadiusKm : settings.immediateSearchRadiusKm * 2;
  const chosen = scored.filter((x) => x.d <= maxR).slice(0, 8);

  const { scheduledFor, requestedRange } = requestedSchedule(f);
  const booked = await bookedListingIds("GARAGE", chosen.map((c) => c.profile!.id), requestedRange);

  const rules = await prisma.pricingRule.findMany({
    where: { ownerProviderId: { in: chosen.map((c) => c.p.id) }, active: true, targetType: "GARAGE_SERVICE" },
  });

  const items: ResultCard[] = chosen
    .filter(({ p, profile }) => {
      if (booked.has(profile!.id)) return false;
      if (requestedRange && p.availabilityStatus === "OFFLINE") return false;
      return true;
    })
    .map(({ p, d, profile }) => {
    const services: string[] = parse(profile!.services, []);
    const rule = rules.find((r) => r.ownerProviderId === p.id) || null;
    const priceFrom = minVisiblePrice(rule);
    return {
      kind: "GARAGE" as const,
      id: profile!.id,
      providerId: p.id,
      title: p.businessName,
      subtitle: services.map(prettyService).join(" • ") + (profile!.open24x7 ? " • 24×7" : ""),
      category: "GARAGE",
      distanceKm: d,
      etaMin: etaMinutes(d),
      availableNow: !scheduledFor && (isAvailableNow(p) || (profile!.open24x7 && p.status === "ACTIVE")),
      priceLabel: priceFrom != null ? `visit from ${inr(priceFrom)}` : "price on request",
      priceFrom,
      rating: p.ratingAvg,
      verified: p.isVerified,
      badges: trustBadges(p),
      emoji: "",
      reason: d <= 5 && (isAvailableNow(p) || profile!.open24x7) ? "Can reach you quickly" : undefined,
      imageUrl: "/images/driver-profile.jpg",
      meta: { open24x7: profile!.open24x7, pickupDrop: profile!.pickupDrop, services: services.join(", ") },
    };
  });

  return {
    querySummary: `Garages near ${center.label}`,
    exactMatchFound: items.length > 0,
    showingAlternatives: false,
    searchedRadiusKm: maxR,
    items: sortByPriority(items, f.sortBy),
  };
}

// ── Farm equipment ────────────────────────────────────────────────────

export async function searchFarm(f: SearchFilters): Promise<SearchResult> {
  const center = await resolveCenter(f);
  const settings = await getSettings();
  const radii = await ladderRadii(f.radiusKm);

  const equipment = await prisma.farmEquipment.findMany({
    where: { status: "ACTIVE" },
    include: { provider: true },
  });

  const filtered = equipment.filter((e) => {
    const p = e.provider;
    if (p.status !== "ACTIVE") return false;
    if (f.category && e.equipmentType !== f.category) return false;
    if (f.acres && e.capacityAcresPerDay && e.capacityAcresPerDay < f.acres) return false;
    return true;
  });

  const withDist = filtered
    .map((e) => ({ e, d: roadDistanceKm(center.lat, center.lng, e.provider.lat, e.provider.lng) }))
    .sort((a, b) => a.d - b.d);

  let chosen = [] as typeof withDist;
  let usedRadius = radii[0];
  for (const radius of radii) {
    usedRadius = radius;
    chosen = withDist.filter((x) => x.d <= radius).slice(0, 8);
    if (chosen.length >= 3) break;
    if (radius >= settings.maxSearchRadiusKm) break;
  }

  const { scheduledFor, requestedRange } = requestedSchedule(f);
  const booked = await bookedListingIds("FARM", chosen.map((c) => c.e.id), requestedRange);

  const rules = await prisma.pricingRule.findMany({
    where: { ownerProviderId: { in: chosen.map((c) => c.e.providerId) }, active: true, targetType: "FARM_EQUIPMENT" },
  });

  const items: ResultCard[] = chosen
    .filter(({ e }) => {
      if (booked.has(e.id)) return false;
      if (requestedRange && e.provider.availabilityStatus === "OFFLINE") return false;
      return true;
    })
    .map(({ e, d }) => {
    const rule =
      rules.find((r) => r.ownerProviderId === e.providerId && r.targetId === e.id) ||
      rules.find((r) => r.ownerProviderId === e.providerId) ||
      null;
    const priceFrom = minVisiblePrice(rule);
    return {
      kind: "FARM" as const,
      id: e.id,
      providerId: e.providerId,
      title: e.title,
      subtitle:
        prettyEquipment(e.equipmentType) +
        (e.hp ? ` • ${e.hp} HP` : "") +
        (e.capacityAcresPerDay ? ` • up to ${e.capacityAcresPerDay}/day acres` : ""),
      category: e.equipmentType,
      distanceKm: d,
      etaMin: etaMinutes(d),
      availableNow: !scheduledFor && isAvailableNow(e.provider),
      priceLabel:
        priceFrom != null
          ? rule?.perAcre
            ? `${inr(rule.perAcre)}/acre`
            : `from ${inr(priceFrom)}`
          : "price on request",
      priceFrom,
      rating: e.provider.ratingAvg,
      verified: e.provider.isVerified,
      badges: trustBadges(e.provider),
      emoji: "",
      reason: undefined,
      imageUrl: "/images/drone.jpg",
      meta: { attachments: parse(e.attachments, []).join(", "), hp: e.hp, capacityPerDay: e.capacityAcresPerDay },
    };
  });

  return {
    querySummary: `Farm equipment near ${center.label}`,
    exactMatchFound: items.length > 0,
    showingAlternatives: false,
    searchedRadiusKm: usedRadius,
    items: sortByPriority(items, f.sortBy),
  };
}

// ── Drone spraying operators ──────────────────────────────────────────

export async function searchDrones(f: SearchFilters): Promise<SearchResult> {
  const center = await resolveCenter(f);
  const settings = await getSettings();

  const providers = await prisma.provider.findMany({
    where: { type: "DRONE", status: "ACTIVE" },
    include: { droneProfile: true },
  });

  const scored = providers
    .map((p) => ({ p, d: roadDistanceKm(center.lat, center.lng, p.lat, p.lng), profile: p.droneProfile }))
    .filter((x) => x.profile)
    .filter((x) => (f.acres ? x.profile!.acresPerDay >= f.acres : true))
    .sort((a, b) => a.d - b.d);

  const chosen = scored.slice(0, 6);

  const { scheduledFor, requestedRange } = requestedSchedule(f);
  const booked = await bookedListingIds("DRONE", chosen.map((c) => c.profile!.id), requestedRange);

  const rules = await prisma.pricingRule.findMany({
    where: { ownerProviderId: { in: chosen.map((c) => c.p.id) }, active: true, targetType: "DRONE_SERVICE" },
  });

const items: ResultCard[] = chosen
    .filter(({ p, profile }) => {
      if (booked.has(profile!.id)) return false;
      if (requestedRange && p.availabilityStatus === "OFFLINE") return false;
      return true;
    })
    .map(({ p, d, profile }) => {
    const rule = rules.find((r) => r.ownerProviderId === p.id) || null;
    const perAcre = rule?.perAcre ?? null;
    const estTotal = perAcre && f.acres ? Math.max(f.acres, rule?.minAcres || 0) * perAcre + (rule?.travelCharge || 0) : null;
    return {
      kind: "DRONE" as const,
      id: profile!.id,
      providerId: p.id,
      title: p.businessName,
      subtitle: `${profile!.dronesCount} drone(s) • up to ${profile!.acresPerDay}/day acres`,
      category: "DRONE_SPRAYING",
      distanceKm: d,
      etaMin: etaMinutes(d),
      availableNow: !scheduledFor && (isAvailableNow(p) || p.availabilityStatus === "SCHEDULED"),
      priceLabel: perAcre != null ? `${inr(perAcre)}/acre` : "price on request",
      priceFrom: estTotal,
      rating: p.ratingAvg,
      verified: p.isVerified,
      badges: trustBadges(p),
      emoji: "",
      reason: estTotal && f.acres ? `≈ ${inr(estTotal)} for ${f.acres} acres` : undefined,
      imageUrl: "/images/drone.jpg",
      meta: { acresPerDay: profile!.acresPerDay, sprayTypes: parse(profile!.sprayTypes, []).join(", "), dronesCount: profile!.dronesCount },
    };
  });

  return {
    querySummary: `Drone spraying near ${center.label}`,
    exactMatchFound: items.length > 0,
    showingAlternatives: false,
    searchedRadiusKm: settings.maxSearchRadiusKm,
    items: sortByPriority(items, f.sortBy),
  };
}

// ── helpers ───────────────────────────────────────────────────────────

/**
 * Booking ids that already block the requested date/range (or currently hold
 * the listing for an immediate job when no date is requested). Mirrors the
 * conflict logic used by vehicles/drivers so scheduled listings are not shown
 * as available for a date they are already booked on.
 */
async function bookedListingIds(
  listingKind: string,
  listingIds: string[],
  requestedRange: { start: Date; end: Date } | null
): Promise<Set<string>> {
  if (!listingIds.length) return new Set();
  const active = ["REQUESTED", "PENDING_PROVIDER", "ACCEPTED", "CONFIRMED", "EN_ROUTE", "IN_PROGRESS"];
  if (requestedRange) {
    const from = new Date(requestedRange.start.getTime() - 24 * 3600_000);
    const to = new Date(requestedRange.end.getTime() + 24 * 3600_000);
    const conflicts = await prisma.booking.findMany({
      where: {
        listingKind,
        listingId: { in: listingIds },
        status: { in: active },
        scheduledFor: { gte: from, lte: to },
      },
      select: { listingId: true },
    });
    return new Set(conflicts.map((c) => c.listingId));
  }
  const holds = await prisma.booking.findMany({
    where: {
      listingKind,
      listingId: { in: listingIds },
      scheduledFor: null,
      status: { in: active },
      OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: new Date() } }],
    },
    select: { listingId: true },
  });
  return new Set(holds.map((c) => c.listingId));
}

function requestedSchedule(f: SearchFilters): { scheduledFor: Date | null; requestedRange: { start: Date; end: Date } | null } {
  const scheduledFor = f.scheduledFor ? new Date(f.scheduledFor) : f.date ? new Date(f.date) : f.startDate ? new Date(f.startDate) : null;
  return { scheduledFor, requestedRange: getRequestedDateRange(f) };
}

function summaryFor(f: SearchFilters): string {
  const bits: string[] = [];
  if (f.rentalMode === "SELF_DRIVE") bits.push("self-drive");
  else if (f.rentalMode === "WITH_DRIVER") bits.push("with driver");
  if (f.model) bits.push(f.model);
  else if (f.category) bits.push(f.category.toLowerCase());
  bits.push("vehicles");
  return `${bits.join(" ")} near ${f.locationText || "you"}`;
}

export function prettyService(s: string): string {
  return (
    {
      MECHANIC: "Mechanic",
      TOWING: "Towing",
      BATTERY: "Battery",
      TYRE: "Tyre",
      ELECTRICAL: "Electrical",
      AC_REPAIR: "AC repair",
      BREAKDOWN: "Breakdown help",
    } as Record<string, string>
  )[s] || s;
}

export function prettyEquipment(t: string): string {
  return (
    {
      TRACTOR: "Tractor",
      TRACTOR_TRAILER: "Tractor + trailer",
      CULTIVATOR: "Cultivator",
      ROTAVATOR: "Rotavator",
      HARVESTER: "Harvester",
      WATER_TANKER: "Water tanker",
      FARM_TRANSPORT: "Farm transport",
      AGRI_MACHINE: "Agri machine",
    } as Record<string, string>
  )[t] || t;
}
