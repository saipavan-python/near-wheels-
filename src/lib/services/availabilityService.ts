import { prisma } from "../db";

export function isAvailableNow(provider: {
  status: string;
  availabilityStatus: string;
}): boolean {
  return provider.status === "ACTIVE" && provider.availabilityStatus === "AVAILABLE_NOW";
}

export function isAvailableForSchedule(provider: {
  status: string;
  availabilityStatus: string;
}): boolean {
  return (
    provider.status === "ACTIVE" &&
    (provider.availabilityStatus === "AVAILABLE_NOW" ||
      provider.availabilityStatus === "SCHEDULED" ||
      provider.availabilityStatus === "BUSY")
  );
}

export function isAvailableNowOrScheduled(provider: {
  status: string;
  availabilityStatus: string;
}): boolean {
  return (
    provider.status === "ACTIVE" &&
    (provider.availabilityStatus === "AVAILABLE_NOW" || provider.availabilityStatus === "SCHEDULED")
  );
}

export function isActiveProvider(provider: { status: string }): boolean {
  return provider.status === "ACTIVE";
}

export function isVehicleStatusActive(vehicle: { status: string }): boolean {
  return vehicle.status === "ACTIVE";
}

// ── Date helpers ────────────────────────────────────────────────────────
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
export function parseDateInput(input?: string | Date | null): Date | null {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return null;
  return d;
}

// ── VehicleAvailability (per-vehicle date blocking) ─────────────────────
export async function isVehicleBlockedByAvailability(
  vehicleId: string,
  scheduledFor: Date | null,
  opts?: { startDate?: Date | null; endDate?: Date | null }
): Promise<{ blocked: boolean; record?: any }> {
  // If no date, no date-based block (but MAINTENANCE vehicle status already filtered)
  let checkStart: Date | null = null;
  let checkEnd: Date | null = null;
  if (opts?.startDate && opts?.endDate) {
    checkStart = startOfDay(opts.startDate);
    checkEnd = endOfDay(opts.endDate);
  } else if (scheduledFor) {
    checkStart = startOfDay(scheduledFor);
    checkEnd = endOfDay(scheduledFor);
  } else {
    // immediate booking -> check today
    // For "available now" we only block if there's a block covering today
    const today = new Date();
    checkStart = startOfDay(today);
    checkEnd = endOfDay(today);
  }

  if (!checkStart || !checkEnd) return { blocked: false };

  // Expired blocks should not count — endDate < today 00:00 is expired
  const nowStart = startOfDay(new Date());

  const found = await prisma.vehicleAvailability.findFirst({
    where: {
      vehicleId,
      AND: [
        { startDate: { lte: checkEnd } },
        { endDate: { gte: checkStart } },
        { endDate: { gte: nowStart } },
      ],
    },
    orderBy: { startDate: "asc" },
  });
  if (found) return { blocked: true, record: found };
  return { blocked: false };
}

export async function isVehicleAvailableForDate(
  vehicleId: string,
  scheduledFor: Date | string | null
): Promise<boolean> {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return false;
  if (!isVehicleStatusActive(vehicle)) return false;
  const d = parseDateInput(scheduledFor);
  // For null (search without date) → only check vehicle status, not date blocks that are future-only
  // But if we want "available now" we check today block
  if (!d) {
    const { blocked } = await isVehicleBlockedByAvailability(vehicleId, null);
    return !blocked;
  }
  const { blocked } = await isVehicleBlockedByAvailability(vehicleId, d);
  if (blocked) return false;
  // Also check booking conflict
  const conflict = await hasConflictingBookings("VEHICLE", vehicleId, d);
  return !conflict;
}

export async function getVehicleAvailabilityStatus(vehicleId: string): Promise<null | { status: string; reason: string | null; note: string | null; startDate: Date; endDate: Date; availableAgain: Date | null }> {
  const now = new Date();
  const nowStart = startOfDay(now);
  const rec = await prisma.vehicleAvailability.findFirst({
    where: { vehicleId, endDate: { gte: nowStart } },
    orderBy: { startDate: "asc" },
  });
  if (!rec) return null;
  // Check if it covers today
  const todayEnd = endOfDay(now);
  const todayStart = startOfDay(now);
  const isToday = rec.startDate <= todayEnd && rec.endDate >= todayStart;
  if (!isToday) {
    // future block — not currently unavailable, but will be
    return null;
  }
  const availableAgain = new Date(rec.endDate);
  availableAgain.setDate(availableAgain.getDate() + 1);
  return {
    status: rec.status,
    reason: rec.reason,
    note: rec.note,
    startDate: rec.startDate,
    endDate: rec.endDate,
    availableAgain,
  };
}

export async function listVehicleAvailabilities(vehicleId: string) {
  const nowStart = startOfDay(new Date());
  return prisma.vehicleAvailability.findMany({
    where: { vehicleId },
    orderBy: { startDate: "asc" },
  });
}

export async function listActiveAvailabilitiesForVehicles(vehicleIds: string[]): Promise<Map<string, any[]>> {
  if (!vehicleIds.length) return new Map();
  const nowStart = startOfDay(new Date());
  const rows = await prisma.vehicleAvailability.findMany({
    where: { vehicleId: { in: vehicleIds }, endDate: { gte: nowStart } },
  });
  const map = new Map<string, any[]>();
  for (const r of rows) {
    if (!map.has(r.vehicleId)) map.set(r.vehicleId, []);
    map.get(r.vehicleId)!.push(r);
  }
  return map;
}

// ── DriverAvailability (per-driver date blocking) ──────────────────────
export async function isDriverBlockedByAvailability(
  driverId: string,
  scheduledFor: Date | null,
  opts?: { startDate?: Date | null; endDate?: Date | null }
): Promise<{ blocked: boolean; record?: any }> {
  let checkStart: Date | null = null;
  let checkEnd: Date | null = null;
  if (opts?.startDate && opts?.endDate) {
    checkStart = startOfDay(opts.startDate);
    checkEnd = endOfDay(opts.endDate);
  } else if (scheduledFor) {
    checkStart = startOfDay(scheduledFor);
    checkEnd = endOfDay(scheduledFor);
  } else {
    const today = new Date();
    checkStart = startOfDay(today);
    checkEnd = endOfDay(today);
  }
  if (!checkStart || !checkEnd) return { blocked: false };

  const nowStart = startOfDay(new Date());
  const found = await prisma.driverAvailability.findFirst({
    where: {
      driverId,
      AND: [
        { startAt: { lte: checkEnd } },
        { endAt: { gte: checkStart } },
        { endAt: { gte: nowStart } },
      ],
    },
    orderBy: { startAt: "asc" },
  });
  if (found) return { blocked: true, record: found };
  return { blocked: false };
}

export async function listActiveDriverAvailabilities(driverIds: string[]): Promise<Map<string, any[]>> {
  if (!driverIds.length) return new Map();
  const nowStart = startOfDay(new Date());
  const rows = await prisma.driverAvailability.findMany({
    where: { driverId: { in: driverIds }, endAt: { gte: nowStart } },
  });
  const map = new Map<string, any[]>();
  for (const r of rows) {
    if (!map.has(r.driverId)) map.set(r.driverId, []);
    map.get(r.driverId)!.push(r);
  }
  return map;
}

function slotRange(a: { startDate?: Date; endDate?: Date; startAt?: Date; endAt?: Date }): [number, number] {
  const s = new Date(a.startDate || a.startAt || 0);
  const e = new Date(a.endDate || a.endAt || 0);
  return [s.getTime(), e.getTime()];
}

export function isDateBlockedByAvailabilities(
  availabilities: { startDate?: Date; endDate?: Date; startAt?: Date; endAt?: Date }[],
  checkDate: Date
): boolean {
  const cs = startOfDay(checkDate).getTime();
  const ce = endOfDay(checkDate).getTime();
  for (const a of availabilities) {
    const [s, e] = slotRange(a);
    if (s <= ce && e >= cs) return true;
  }
  return false;
}

export function isRangeBlockedByAvailabilities(
  availabilities: { startDate?: Date; endDate?: Date; startAt?: Date; endAt?: Date }[],
  start: Date,
  end: Date
): boolean {
  const cs = startOfDay(start).getTime();
  const ce = endOfDay(end).getTime();
  for (const a of availabilities) {
    const [s, e] = slotRange(a);
    if (s <= ce && e >= cs) return true;
  }
  return false;
}

/** Future availability ≠ current availability (spec §19). */
export async function hasConflictingBookings(
  listingKind: string,
  listingId: string,
  scheduledFor: Date,
  windowHours = 24
): Promise<boolean> {
  const from = new Date(scheduledFor.getTime() - windowHours * 3600_000);
  const to = new Date(scheduledFor.getTime() + windowHours * 3600_000);
  const conflicts = await prisma.booking.count({
    where: {
      listingKind,
      listingId,
      scheduledFor: scheduledFor ? { gte: from, lte: to } : undefined,
      status: { in: ["REQUESTED", "PENDING_PROVIDER", "ACCEPTED", "CONFIRMED", "EN_ROUTE", "IN_PROGRESS"] },
    },
  });
  return conflicts > 0;
}

export async function hasActiveImmediateHold(
  listingKind: string,
  listingId: string
): Promise<boolean> {
  const holds = await prisma.booking.count({
    where: {
      listingKind,
      listingId,
      scheduledFor: null,
      status: { in: ["REQUESTED", "PENDING_PROVIDER", "ACCEPTED", "CONFIRMED", "EN_ROUTE", "IN_PROGRESS"] },
      OR: [
        { holdExpiresAt: null },
        { holdExpiresAt: { gt: new Date() } },
      ],
    },
  });
  return holds > 0;
}

/**
 * Race-condition guard (spec §93): atomically reserve a listing.
 * Returns true if we won the reservation.
 * For VEHICLE, also checks VehicleAvailability and vehicle status.
 */
export async function reserveListingAtomic(
  listingKind: string,
  listingId: string,
  scheduledFor: Date | null,
  opts?: { durationDays?: number }
): Promise<boolean> {
  if (listingKind === "VEHICLE") {
    // Check vehicle status
    const vehicle = await prisma.vehicle.findUnique({ where: { id: listingId } });
    if (!vehicle) return false;
    if (!isVehicleStatusActive(vehicle)) return false;

    // Check date-block availability
    if (scheduledFor) {
      let endDate: Date | null = null;
      if (opts?.durationDays && opts.durationDays > 1) {
        endDate = new Date(scheduledFor);
        endDate.setDate(endDate.getDate() + (opts.durationDays - 1));
      }
      const checkOpts = endDate ? { startDate: scheduledFor, endDate } : undefined;
      const { blocked } = await isVehicleBlockedByAvailability(listingId, scheduledFor, checkOpts);
      if (blocked) return false;
    } else {
      // Immediate booking checks today block
      const { blocked } = await isVehicleBlockedByAvailability(listingId, null);
      if (blocked) return false;
    }
  }
  if (listingKind === "DRIVER") {
    // Roster drivers are individual listings; DriverProfile (provider-as-driver)
    // falls back to provider availability only.
    const driver = await prisma.driver.findUnique({ where: { id: listingId } });
    if (driver) {
      if (driver.status !== "ACTIVE") return false;
      let endDate: Date | null = null;
      if (scheduledFor) {
        if (opts?.durationDays && opts.durationDays > 1) {
          endDate = new Date(scheduledFor);
          endDate.setDate(endDate.getDate() + (opts.durationDays - 1));
        }
        const checkOpts = endDate ? { startDate: scheduledFor, endDate } : undefined;
        const { blocked } = await isDriverBlockedByAvailability(listingId, scheduledFor, checkOpts);
        if (blocked) return false;
      } else {
        const { blocked } = await isDriverBlockedByAvailability(listingId, null);
        if (blocked) return false;
      }
    }
  }

  if (scheduledFor) {
    const conflict = await hasConflictingBookings(listingKind, listingId, scheduledFor);
    return !conflict;
  }
  return !(await hasActiveImmediateHold(listingKind, listingId));
}

// Helper to check if provider can manage vehicle (ownership)
export async function assertVehicleOwnership(vehicleId: string, providerId: string): Promise<boolean> {
  const v = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  return !!v && v.providerId === providerId;
}
