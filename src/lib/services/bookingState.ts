import { prisma } from "../db";
import type { Booking } from "@prisma/client";

/** Booking state machine — PENDING → Admin confirms → CONFIRMED */
const ALLOWED: Record<string, string[]> = {
  PENDING: ["ACCEPTED", "CONFIRMED", "REJECTED", "CANCELLED", "ADMIN_REVIEW"],
  ADMIN_REVIEW: ["CONFIRMED", "REJECTED", "CANCELLED"],
  REQUESTED: ["PENDING", "PENDING_PROVIDER", "ACCEPTED", "REJECTED", "CANCELLED"],
  PENDING_PROVIDER: ["ACCEPTED", "REJECTED", "CANCELLED", "CONFIRMED"],
  ACCEPTED: ["CONFIRMED", "EN_ROUTE", "IN_PROGRESS", "CANCELLED", "DISPUTED"],
  CONFIRMED: ["EN_ROUTE", "IN_PROGRESS", "CANCELLED", "DISPUTED", "COMPLETED"],
  EN_ROUTE: ["IN_PROGRESS", "COMPLETED", "DISPUTED"],
  IN_PROGRESS: ["COMPLETED", "DISPUTED"],
  COMPLETED: ["REFUNDED", "DISPUTED"],
  CANCELLED: ["REFUNDED"],
  REJECTED: [],
  REFUNDED: [],
  DISPUTED: ["REFUNDED", "COMPLETED"],
};

export class InvalidTransitionError extends Error {}

export function canTransition(from: string, to: string): boolean {
  return (ALLOWED[from] || []).includes(to);
}

/** Expire stale provider holds and free the listing */
export async function expireStaleHolds(): Promise<number> {
  const stale = await prisma.booking.findMany({
    where: {
      status: { in: ["PENDING", "PENDING_PROVIDER", "ADMIN_REVIEW"] },
      holdExpiresAt: { lt: new Date() },
      scheduledFor: null,
    },
    take: 20,
  });
  for (const b of stale) {
    await prisma.booking.update({
      where: { id: b.id },
      data: { status: "REJECTED", cancelReason: "Provider did not respond in time" },
    });
    await prisma.provider.update({
      where: { id: b.providerId },
      data: { availabilityStatus: "AVAILABLE_NOW" },
    }).catch(() => undefined);
  }
  return stale.length;
}

export function publicBooking(b: Booking) {
  const breakdown = safeParse(b.priceBreakdownJson);
  return {
    id: b.id,
    code: b.code,
    status: b.status,
    paymentStatus: b.paymentStatus,
    kind: b.kind,
    listingKind: b.listingKind,
    listingId: b.listingId,
    listingTitle: b.listingTitle,
    providerId: b.providerId,
    providerName: b.providerName,
    customerId: b.customerId, // needed for ownership checks on cancel/modify
    scheduledFor: b.scheduledFor,
    durationDays: b.durationDays,
    durationHours: b.durationHours,
    acres: b.acres,
    estKm: b.estKm,
    locationText: b.locationText,
    distanceKm: b.distanceKm,
    etaMin: b.etaMin,
    totalAmount: b.totalAmount,
    depositAmount: b.depositAmount,
    baseAmount: b.baseAmount,
    feesAmount: b.feesAmount,
    commissionAmount: b.commissionAmount,
    tripOtp: b.tripOtp ?? null,
    otpVerifiedAt: b.otpVerifiedAt ?? null,
    endOtpVerifiedAt: b.endOtpVerifiedAt ?? null,
    pickupPhotoUrl: b.pickupPhotoUrl ?? null,
    dropoffPhotoUrl: b.dropoffPhotoUrl ?? null,
    startedAt: b.startedAt ?? null,
    endedAt: b.endedAt ?? null,
    cancellationFee: b.cancellationFee ?? null,
    refundAmount: b.refundAmount ?? null,
    cancelledAt: b.cancelledAt ?? null,
    breakdown,
    createdAt: b.createdAt,
    cancelReason: b.cancelReason,
  };
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
}
