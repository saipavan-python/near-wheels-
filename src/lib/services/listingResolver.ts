import { prisma } from "../db";
import { isAvailableNow } from "./availabilityService";
import { garageStatus } from "./garageHours";
import type {
  Vehicle,
  DriverProfile,
  GarageProfile,
  FarmEquipment,
  DroneProfile,
} from "@prisma/client";

type Providerish = { id: string; businessName: string; lat: number; lng: number; status: string; availabilityStatus: string };

export interface ResolvedListing {
  providerId: string;
  listingId: string;
  vehicleId: string | null;
  listingTitle: string;
  providerName: string;
  targetType: string;
  lat: number;
  lng: number;
  availableNow: boolean;
}

export class ListingUnavailableError extends Error {}

export async function resolveListing(input: {
  listingKind: string;
  listingId?: string;
  providerId?: string;
  vehicleId?: string;
}): Promise<ResolvedListing> {
  const kind = input.listingKind;
  if (kind === "VEHICLE") {
    const v = await prisma.vehicle.findUnique({
      where: { id: input.vehicleId || input.listingId },
      include: { provider: true },
    });
    assertVehicle(v);
    const p = v!.provider as Providerish;
    return base(p, v!.id, v!.id, v!.title, p.businessName, "VEHICLE", isAvailableNow(p));
  }
  if (kind === "DRIVER") {
    // Roster driver (provider-owned) takes precedence — each driver is a listing.
    const dr = await prisma.driver.findUnique({ where: { id: input.listingId }, include: { provider: true } });
    if (dr) {
      if (dr.status !== "ACTIVE" || dr.provider.status !== "ACTIVE")
        throw new ListingUnavailableError("Driver not available");
      const p = dr.provider as Providerish;
      return base(p, dr.id, null, `${dr.name} (driver)`, p.businessName, "DRIVER", isAvailableNow(p));
    }
    const d = await prisma.driverProfile.findUnique({ where: { id: input.listingId }, include: { provider: true } });
    if (!d || d.provider.status !== "ACTIVE") throw new ListingUnavailableError("Driver not available");
    const p = d.provider as Providerish;
    return base(p, d.id, null, `${p.businessName} (driver)`, p.businessName, "DRIVER", isAvailableNow(p));
  }
  if (kind === "GARAGE") {
    const g = await prisma.garageProfile.findUnique({ where: { id: input.listingId }, include: { provider: true } });
    if (!g || g.provider.status !== "ACTIVE") throw new ListingUnavailableError("Garage not available");
    const p = g.provider as Providerish;
    return base(p, g.id, null, p.businessName, p.businessName, "GARAGE_SERVICE", garageStatus(g, p).open);
  }
  if (kind === "FARM") {
    const e = await prisma.farmEquipment.findUnique({ where: { id: input.listingId }, include: { provider: true } });
    if (!e || e.status !== "ACTIVE" || e.provider.status !== "ACTIVE")
      throw new ListingUnavailableError("Equipment not available");
    const p = e.provider as Providerish;
    return base(p, e.id, null, e.title, p.businessName, "FARM_EQUIPMENT", isAvailableNow(p));
  }
  const dr = await prisma.droneProfile.findUnique({ where: { id: input.listingId }, include: { provider: true } });
  if (!dr || dr.provider.status !== "ACTIVE") throw new ListingUnavailableError("Drone operator not available");
  const p = dr.provider as Providerish;
  return base(p, dr.id, null, `${p.businessName} (drone spraying)`, p.businessName, "DRONE_SERVICE", isAvailableNow(p));
}

function assertVehicle(v: (Vehicle & { provider: Providerish }) | null): void {
  if (!v || v.status !== "ACTIVE" || v.provider.status !== "ACTIVE")
    throw new ListingUnavailableError("Vehicle not available");
}

function base(
  provider: Providerish,
  listingId: string,
  vehicleId: string | null,
  title: string,
  providerName: string,
  targetType: string,
  availableNow: boolean
): ResolvedListing {
  return {
    providerId: provider.id,
    listingId,
    vehicleId,
    listingTitle: title,
    providerName,
    targetType,
    lat: provider.lat,
    lng: provider.lng,
    availableNow,
  };
}
