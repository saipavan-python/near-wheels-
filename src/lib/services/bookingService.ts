import { prisma } from "../db";
import { getSettings, FREE_MODE } from "../config";
import { roadDistanceKm, etaMinutes } from "../geo";
import { quoteFromRule, findRuleForTarget } from "./pricingService";
import { reserveListingAtomic } from "./availabilityService";
import { resolveListing, ListingUnavailableError } from "./listingResolver";
import { notifyUser, notifyProvider } from "./notificationService";
import { track } from "./analyticsService";
import { audit } from "./auditService";
import { canTransition, expireStaleHolds, publicBooking, InvalidTransitionError } from "./bookingState";
import { roundMoney } from "./paymentGuard";
import { bookingCode, json, tripOtp } from "../utils";
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
        tripOtp: tripOtp(),
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
    "/provider/dashboard",
    "BOOKING"
  );

  if (FREE_MODE) {
    // Free launch period: the booking is confirmed automatically — no payment.
    if (booking.status !== "CONFIRMED") await moveStatus(booking.id, "CONFIRMED");
    await prisma.provider.update({
      where: { id: booking.providerId },
      data: { totalRequests: { increment: 1 }, acceptedRequests: { increment: 1 } },
    });
    await notifyUser(
      booking.customerId,
      "Booking confirmed",
      `Your booking (${booking.code}) with ${booking.providerName} is confirmed. No advance or payment needed right now.`,
      "/bookings",
      "SUCCESS"
    );
  } else if (!scheduledFor) {
    await dispatchImmediate(booking.id);
  }

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

  // Cancellation policy: free before the window, else a fee on the total.
  const settings = await getSettings();
  let cancelFee = 0;
  let refundAmount: number | null = null;
  const paid = b.paymentStatus === "PAID";
  const late =
    b.scheduledFor &&
    b.scheduledFor.getTime() - Date.now() < settings.cancellationWindowHours * 3600_000;
  if (paid && (late || ["ACCEPTED", "CONFIRMED", "EN_ROUTE", "IN_PROGRESS"].includes(b.status))) {
    cancelFee = roundMoney(b.totalAmount * settings.cancellationFeePercent);
    refundAmount = roundMoney(Math.max(0, b.totalAmount - cancelFee));
  } else if (paid) {
    refundAmount = b.totalAmount;
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      cancelReason: reason || "",
      cancellationFee: cancelFee > 0 ? cancelFee : null,
      refundAmount,
      cancelledAt: new Date(),
    },
  });

  await audit(actorRole, undefined, "CANCEL_BOOKING", "Booking", bookingId, { reason, cancelFee });

  // Auto-refund the customer through the payment pipeline (idempotent).
  let refundMessage = "";
  if (paid) {
    const pay = await prisma.payment.findFirst({
      where: { bookingId, status: "SUCCESS" },
      orderBy: { createdAt: "desc" },
    });
    if (pay) {
      try {
        const { refundPayment } = await import("./paymentService");
        const res = await refundPayment(pay.id, { amount: refundAmount ?? undefined, leaveBookingStatus: true });
        refundMessage = res?.refunded ? ` ₹${refundAmount} refunded.` : "";
      } catch {
        refundMessage = "";
      }
    }
  }

  await Promise.all([
    notifyUser(b.customerId, "Booking cancelled", `${b.code} was cancelled.${cancelFee > 0 ? ` A ₹${cancelFee} cancellation fee applies.` : " Full refund processed."}${refundMessage}`, "/bookings", "WARN"),
    notifyProvider(b.providerId, "Booking cancelled", `${b.code} was cancelled by the customer.`, "/provider/dashboard", "WARN"),
    prisma.provider.update({ where: { id: b.providerId }, data: { cancelledJobs: { increment: 1 }, availabilityStatus: "AVAILABLE_NOW" } }).catch(() => undefined),
  ]);
  return { ...updated, cancellationFee: cancelFee };
}

export async function completeBooking(bookingId: string) {
  const b = await moveStatus(bookingId, "COMPLETED");
  await prisma.booking.update({ where: { id: bookingId }, data: { endedAt: new Date() } });
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

/** Verify the rider's trip OTP. Wrong OTP throws; correct OTP is recorded. */
export async function verifyTripOtp(bookingId: string, otp: string | null | undefined, phase: "PICKUP" | "DROPOFF"): Promise<boolean> {
  const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (!b.tripOtp) throw new Error("No trip OTP has been generated for this booking");
  if (!otp || otp.trim() !== b.tripOtp) return false;
  await prisma.booking.update({
    where: { id: bookingId },
    data: phase === "PICKUP" ? { otpVerifiedAt: new Date() } : { endOtpVerifiedAt: new Date() },
  });
  return true;
}

/** Start a trip: rider OTP verified + pickup photo evidence captured. */
export async function startTrip(bookingId: string, otp: string | null | undefined, pickupPhotoUrl?: string) {
  const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (!["CONFIRMED", "EN_ROUTE", "ACCEPTED"].includes(b.status)) throw new InvalidTransitionError(`Cannot start trip from ${b.status}`);
  const okOtp = await verifyTripOtp(bookingId, otp, "PICKUP");
  if (!okOtp) throw new Error("The trip OTP did not match. Ask the rider for the correct code.");
  const updated = await moveStatus(bookingId, "IN_PROGRESS");
  await prisma.booking.update({
    where: { id: bookingId },
    data: { startedAt: new Date(), pickupPhotoUrl: pickupPhotoUrl || b.pickupPhotoUrl },
  });
  await notifyUser(b.customerId, "Trip started", `${b.code} has started.`, "/bookings", "INFO");
  return { ...updated, otpVerified: true };
}

/** Complete a trip: end OTP verified + dropoff photo evidence captured. */
export async function completeTrip(bookingId: string, otp: string | null | undefined, dropoffPhotoUrl?: string) {
  const b = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (!["IN_PROGRESS"].includes(b.status)) throw new InvalidTransitionError(`Cannot complete trip from ${b.status}`);
  const okOtp = await verifyTripOtp(bookingId, otp, "DROPOFF");
  if (!okOtp) throw new Error("The trip OTP did not match. Ask the rider for the correct code.");
  await prisma.booking.update({
    where: { id: bookingId },
    data: { dropoffPhotoUrl: dropoffPhotoUrl || b.dropoffPhotoUrl, endedAt: new Date() },
  });
  const updated = await moveStatus(bookingId, "COMPLETED");
  await prisma.provider.update({
    where: { id: b.providerId },
    data: { completedJobs: { increment: 1 }, availabilityStatus: "AVAILABLE_NOW" },
  });
  await prisma.payout.updateMany({ where: { bookingId }, data: { status: "PROCESSING" } });
  await notifyUser(b.customerId, "Service completed", `${b.code} is complete. How did it go? Leave a review.`, "/bookings", "SUCCESS");
  return { ...updated, otpVerified: true };
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
    include: { payments: true, review: true, vehicle: true, driver: true },
  });
  return rows.map(publicBookingWithExtras);
}

export async function bookingsForProvider(providerId: string, take?: number) {
  const rows = await prisma.booking.findMany({
    where: { providerId },
    orderBy: { createdAt: "desc" },
    take: take ?? 200,
    include: {
      payments: true,
      review: true,
      vehicle: true,
      driver: true,
      customer: { select: { name: true, phone: true } },
    },
  });
  return rows.map(publicBookingWithExtras);
}

export async function getPublicBooking(idOrCode: string) {
  const b = await prisma.booking.findFirst({
    where: { OR: [{ id: idOrCode }, { code: idOrCode.toUpperCase() }] },
    include: { payments: true, review: true, vehicle: true, driver: true },
  });
  return b ? publicBookingWithExtras(b) : null;
}

/** Resolve the driver + vehicle snapshot a rider should see for a booking. */
export async function bookingRiderDetails(bookingId: string) {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { driver: true, vehicle: true },
  });
  if (!b) return null;
  return {
    driver: b.driver
      ? {
          name: b.driver.name,
          photoUrl: b.driver.photoUrl,
          phone: b.driver.phone,
          rating: b.driver.rating,
          licenseVerified: (b.driver.licenseStatus || "PENDING") === "APPROVED",
          verified: (b.driver.verificationStatus || "PENDING") === "VERIFIED",
        }
      : null,
    vehicle: b.vehicle
      ? {
          title: b.vehicle.title,
          make: b.vehicle.make,
          model: b.vehicle.model,
          category: b.vehicle.category,
          registrationNumber: b.vehicle.registrationNumber,
          color: b.vehicle.color,
          imageUrl: b.vehicle.imageUrl,
          seats: b.vehicle.seats,
          fuelType: b.vehicle.fuelType,
          transmission: b.vehicle.transmission,
        }
      : null,
  };
}

function publicBookingWithExtras(
  b: Booking & { payments: unknown[]; review: unknown; vehicle?: unknown; driver?: unknown; customer?: { name: string | null; phone: string | null } | null }
) {
  const base = publicBooking(b);
  const v = b.vehicle as
    | { id: string; title: string; make: string; model: string; category: string; registrationNumber: string | null; color?: string | null; imageUrl: string | null; seats: number; fuelType: string | null; transmission: string | null }
    | null
    | undefined;
  const d = b.driver as
    | { id: string; name: string; phone: string | null; photoUrl: string | null; rating: number }
    | null
    | undefined;
  return {
    ...base,
    customerPhone: b.customer?.phone ?? null,
    customerName: b.customer?.name ?? null,
    vehicle: v
      ? {
          id: v.id,
          title: v.title,
          make: v.make,
          model: v.model,
          category: v.category,
          registrationNumber: v.registrationNumber,
          color: v.color ?? null,
          imageUrl: v.imageUrl,
          seats: v.seats,
          fuelType: v.fuelType,
          transmission: v.transmission,
        }
      : null,
    driver: d
      ? { id: d.id, name: d.name, photoUrl: d.photoUrl, phone: d.phone, rating: d.rating }
      : null,
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
