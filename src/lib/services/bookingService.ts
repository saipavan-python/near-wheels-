import { prisma } from "../db";
import { getSettings } from "../config";
import { roadDistanceKm, etaMinutes } from "../geo";
import { quoteFromRule, findRuleForTarget } from "./pricingService";
import { reserveListingAtomic } from "./availabilityService";
import { resolveListing, ListingUnavailableError } from "./listingResolver";
import { notifyUser, notifyProvider } from "./notificationService";
import { track } from "./analyticsService";
import { audit } from "./auditService";
import { canTransition, expireStaleHolds, publicBooking, InvalidTransitionError } from "./bookingState";
import { bookingCode, json } from "../utils";
import type { Booking } from "@prisma/client";

export class BookingConflictError extends Error {
  constructor() {
    super("LISTING_JUST_BOOKED");
  }
}

export interface CreateBookingInput {
  customerId: string;
  kind: string;
  listingKind: "VEHICLE" | "DRIVER" | "GARAGE" | "FARM" | "DRONE";
  listingId?: string;
  providerId?: string;
  vehicleId?: string;
  scheduledFor?: string | null;
  durationDays?: number;
  durationHours?: number;
  acres?: number;
  estKm?: number;
  ac?: boolean | null;
  locationText?: string;
  destLat?: number;
  destLng?: number;
  notes?: string;
  idempotencyKey: string;
}

export async function createBooking(input: CreateBookingInput) {
  // Idempotency first (spec §84): double-taps never create two bookings.
  const existing = await prisma.booking.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return { booking: existing, idempotentReplay: true };

  await expireStaleHolds();
  const settings = await getSettings();
  const listing = await resolveListing(input);
  const provider = await prisma.provider.findUniqueOrThrow({ where: { id: listing.providerId } });
  if (!["ACTIVE", "VERIFIED"].includes(provider.status)) throw new ListingUnavailableError("Provider is not active");

  const scheduledFor = input.scheduledFor ? new Date(input.scheduledFor) : null;

  // Validate vehicle status for VEHICLE bookings
  if (input.listingKind === "VEHICLE") {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: listing.listingId } });
    if (!vehicle || vehicle.status !== "ACTIVE") throw new ListingUnavailableError("Vehicle is not available");
  }
  // Validate roster driver status for DRIVER bookings
  if (input.listingKind === "DRIVER") {
    const driver = await prisma.driver.findUnique({ where: { id: listing.listingId } });
    if (driver && driver.status !== "ACTIVE") throw new ListingUnavailableError("Driver is not available");
  }

  // Atomic reservation (spec §93) — includes VehicleAvailability + booking conflict + duration
  const reserved = await reserveListingAtomic(input.listingKind, listing.listingId, scheduledFor, { durationDays: input.durationDays });
  if (!reserved) throw new BookingConflictError();

  // Backend-computed price + snapshot (spec §29–31, §94). AI/UI amounts ignored.
  const rule = await findRuleForTarget(listing.providerId, listing.targetType, listing.listingId);
  const quote = quoteFromRule(rule, {
    days: input.durationDays,
    hours: input.durationHours,
    km: input.estKm,
    acres: input.acres,
    ac: input.ac ?? null,
  });

  let distanceKm: number | null = null;
  let etaMin: number | null = null;
  if (input.destLat != null && input.destLng != null) {
    distanceKm = roadDistanceKm(listing.lat, listing.lng, input.destLat, input.destLng);
    etaMin = etaMinutes(distanceKm);
  }

  // Transactional double-check to prevent race (spec §93).
  // The FOR UPDATE lock on the provider row serializes concurrent booking
  // attempts for the same provider: with READ COMMITTED alone, two requests
  // could both pass the conflict re-check and double-book the listing.
  const booking = await prisma.$transaction(
    async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Provider" WHERE id = ${listing.providerId} FOR UPDATE`;
    // Re-check within transaction
    if (input.listingKind === "VEHICLE" && scheduledFor) {
      const conflict = await tx.booking.count({
        where: {
          listingKind: "VEHICLE",
          listingId: listing.listingId,
          status: { in: ["PENDING", "ADMIN_REVIEW", "REQUESTED", "PENDING_PROVIDER", "ACCEPTED", "CONFIRMED", "EN_ROUTE", "IN_PROGRESS"] },
          scheduledFor: {
            gte: new Date(scheduledFor.getTime() - 24 * 3600_000),
            lte: new Date(scheduledFor.getTime() + 24 * 3600_000),
          },
        },
      });
      if (conflict > 0) throw new BookingConflictError();
      // Also check VehicleAvailability inside tx
      const avail = await tx.vehicleAvailability.findFirst({
        where: {
          vehicleId: listing.listingId,
          AND: [
            { startDate: { lte: scheduledFor } },
            { endDate: { gte: scheduledFor } },
          ],
        },
      });
      if (avail) throw new BookingConflictError();
    }
    if (input.listingKind === "DRIVER") {
      // Roster driver double-booking + availability re-check inside tx (race guard)
      const isRoster = await tx.driver.findUnique({ where: { id: listing.listingId } });
      if (isRoster) {
        const dConflict = await tx.booking.count({
          where: {
            listingKind: "DRIVER",
            listingId: listing.listingId,
            status: { in: ["PENDING", "ADMIN_REVIEW", "REQUESTED", "PENDING_PROVIDER", "ACCEPTED", "CONFIRMED", "EN_ROUTE", "IN_PROGRESS"] },
            scheduledFor: scheduledFor
              ? { gte: new Date(scheduledFor.getTime() - 24 * 3600_000), lte: new Date(scheduledFor.getTime() + 24 * 3600_000) }
              : undefined,
          },
        });
        if (dConflict > 0) throw new BookingConflictError();
        const dAvail = scheduledFor
          ? await tx.driverAvailability.findFirst({
              where: {
                driverId: listing.listingId,
                AND: [{ startAt: { lte: scheduledFor } }, { endAt: { gte: scheduledFor } }],
              },
            })
          : await tx.driverAvailability.findFirst({
              where: {
                driverId: listing.listingId,
                startAt: { lte: new Date() },
                endAt: { gte: new Date() },
              },
            });
        if (dAvail) throw new BookingConflictError();
      }
    }
    if (input.listingKind === "VEHICLE" && !scheduledFor) {
      const hold = await tx.booking.count({
        where: {
          listingKind: "VEHICLE",
          listingId: listing.listingId,
          scheduledFor: null,
          status: { in: ["PENDING", "ADMIN_REVIEW", "REQUESTED", "PENDING_PROVIDER", "ACCEPTED", "CONFIRMED", "EN_ROUTE", "IN_PROGRESS"] },
          OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: new Date() } }],
        },
      });
      if (hold > 0) throw new BookingConflictError();
      const today = new Date();
      const todayStart = new Date(today); todayStart.setHours(0,0,0,0);
      const todayEnd = new Date(today); todayEnd.setHours(23,59,59,999);
      const availToday = await tx.vehicleAvailability.findFirst({
        where: {
          vehicleId: listing.listingId,
          startDate: { lte: todayEnd },
          endDate: { gte: todayStart },
        },
      });
      if (availToday) throw new BookingConflictError();
    }

    return tx.booking.create({
      data: {
        code: bookingCode(),
        customerId: input.customerId,
        providerId: listing.providerId,
        kind: input.kind,
        listingKind: input.listingKind,
        listingId: listing.listingId,
        vehicleId: listing.vehicleId,
        listingTitle: listing.listingTitle,
        providerName: listing.providerName,
        status: "PENDING",
        paymentStatus: "UNPAID",
        scheduledFor,
        durationDays: input.durationDays ?? null,
        durationHours: input.durationHours ?? null,
        acres: input.acres ?? null,
        estKm: input.estKm ?? null,
        withAc: input.ac ?? null,
        locationText: input.locationText ?? null,
        destLat: input.destLat ?? null,
        destLng: input.destLng ?? null,
        priceBreakdownJson: json(quote.lines),
        baseAmount: quote.total,
        feesAmount: 0,
        totalAmount: quote.total,
        depositAmount: rule?.deposit ?? null,
        etaMin,
        distanceKm,
        notes: input.notes ?? "",
        idempotencyKey: input.idempotencyKey,
        holdExpiresAt: new Date(Date.now() + settings.providerResponseTimeoutSec * 1000),
      },
    });
  });

  await audit("CUSTOMER", input.customerId, "CREATE_BOOKING", "Booking", booking.id, {
    kind: booking.kind,
    amount: booking.totalAmount,
  });
  await track("booking_created", { kind: booking.kind }, { customerId: input.customerId });
  await notifyProvider(
    listing.providerId,
    "New booking request",
    `New ${input.kind.replace(/_/g, " ").toLowerCase()} request.`,
    "/providers/dashboard",
    "BOOKING"
  );

  if (!scheduledFor) await dispatchImmediate(booking.id);

  const fresh = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
  return { booking: fresh, idempotentReplay: false };
}

/** Simulated dispatch network (spec §40): auto-accept providers respond instantly. */
async function dispatchImmediate(bookingId: string) {
  const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const provider = await prisma.provider.findUniqueOrThrow({ where: { id: b.providerId } });
  const settings = await getSettings();

  await prisma.provider.update({
    where: { id: b.providerId },
    data: { totalRequests: { increment: 1 } },
  });

  if (provider.autoAccept && settings.demoAutoAcceptProviders) {
    await moveStatus(b.id, "ACCEPTED");
    await prisma.provider.update({
      where: { id: b.providerId },
      data: { acceptedRequests: { increment: 1 } },
    });
    await notifyUser(b.customerId, "Request accepted", `${b.providerName} accepted your request (${b.code}).`, "/bookings", "SUCCESS");
  }
}

export async function moveStatus(bookingId: string, next: string) {
  const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (!canTransition(b.status, next)) throw new InvalidTransitionError(`Cannot go ${b.status} → ${next}`);
  return prisma.booking.update({ where: { id: bookingId }, data: { status: next } });
}

export async function cancelBooking(bookingId: string, actorRole: string, reason?: string) {
  const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const updated = await moveStatus(bookingId, "CANCELLED");
  await prisma.booking.update({ where: { id: bookingId }, data: { cancelReason: reason || "" } });
  await audit(actorRole, undefined, "CANCEL_BOOKING", "Booking", bookingId, { reason });
  await Promise.all([
    notifyUser(b.customerId, "Booking cancelled", `${b.code} was cancelled.`, "/bookings", "WARN"),
    notifyProvider(b.providerId, "Booking cancelled", `${b.code} was cancelled by the customer.`, "/providers/dashboard", "WARN"),
    prisma.provider.update({ where: { id: b.providerId }, data: { cancelledJobs: { increment: 1 }, availabilityStatus: "AVAILABLE_NOW" } }).catch(() => undefined),
  ]);
  return updated;
}

export async function completeBooking(bookingId: string) {
  const b = await moveStatus(bookingId, "COMPLETED");
  await prisma.provider.update({
    where: { id: b.providerId },
    data: {
      completedJobs: { increment: 1 },
      availabilityStatus: "AVAILABLE_NOW",
    },
  });
  await prisma.payout.updateMany({ where: { bookingId }, data: { status: "PROCESSING" } });
  await notifyUser(b.customerId, "Service completed", `${b.code} is complete. How did it go? Leave a review.`, "/bookings", "SUCCESS");
  return b;
}

export async function modifyBookingSchedule(
  bookingId: string,
  changes: { scheduledFor?: Date; durationDays?: number; durationHours?: number }
) {
  const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (!["REQUESTED", "PENDING_PROVIDER", "ACCEPTED"].includes(b.status))
    throw new InvalidTransitionError("This booking can no longer be modified");

  const listing = await resolveListing({ listingKind: b.listingKind, listingId: b.listingId });
  const when = changes.scheduledFor || b.scheduledFor;
  const reserved = await reserveListingAtomic(b.listingKind, b.listingId, when as Date | null);
  if (!reserved) throw new BookingConflictError();

  const rule = await findRuleForTarget(b.providerId, listing.targetType, b.listingId);
  const quote = quoteFromRule(rule, {
    days: changes.durationDays ?? b.durationDays ?? undefined,
    hours: changes.durationHours ?? b.durationHours ?? undefined,
    km: b.estKm ?? undefined,
    acres: b.acres ?? undefined,
    ac: b.withAc,
  });

  return prisma.booking.update({
    where: { id: bookingId },
    data: {
      scheduledFor: changes.scheduledFor ?? b.scheduledFor,
      durationDays: changes.durationDays ?? b.durationDays,
      durationHours: changes.durationHours ?? b.durationHours,
      priceBreakdownJson: json(quote.lines),
      totalAmount: quote.total,
      baseAmount: quote.total,
    },
  });
}

export async function bookingsForCustomer(customerId: string, take?: number) {
  const rows = await prisma.booking.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take: take ?? 200,
    include: { payments: true, review: true },
  });
  return rows.map(publicBookingWithExtras);
}

export async function bookingsForProvider(providerId: string, take?: number) {
  const rows = await prisma.booking.findMany({
    where: { providerId },
    orderBy: { createdAt: "desc" },
    take: take ?? 200,
    include: { payments: true, review: true },
  });
  return rows.map(publicBookingWithExtras);
}

export async function getPublicBooking(idOrCode: string) {
  const b = await prisma.booking.findFirst({
    where: { OR: [{ id: idOrCode }, { code: idOrCode.toUpperCase() }] },
    include: { payments: true, review: true },
  });
  return b ? publicBookingWithExtras(b) : null;
}

function publicBookingWithExtras(
  b: Booking & { payments: unknown[]; review: unknown }
) {
  return {
    ...publicBooking(b),
    payments: Array.isArray(b.payments)
      ? (b.payments as { id: string; status: string; amount: number; gatewayRef: string | null }[]).map((p) => ({
          id: p.id,
          status: p.status,
          amount: p.amount,
          gatewayRef: p.gatewayRef,
        }))
      : [],
    review:
      b.review && !Array.isArray(b.review)
        ? (b.review as { rating: number; comment: string | null })
        : null,
  };
}
