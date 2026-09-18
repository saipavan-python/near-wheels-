import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/db";
import { moveStatus, startTrip, completeTrip } from "@/lib/services/bookingService";
import { notifyUser } from "@/lib/services/notificationService";

export const runtime = "nodejs";

/** Provider-side actions on their own bookings + availability toggle. */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || session.role !== "PROVIDER") return fail("Provider login required", 403);
  const provider = await prisma.provider.findFirst({ where: { userId: session.userId } });
  if (!provider) return fail("No provider profile for this account", 404);

  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "");

  switch (action) {
    case "set_availability": {
      const allowed = ["AVAILABLE_NOW", "BUSY", "SCHEDULED", "OFFLINE", "MAINTENANCE"];
      const status = String(b.availabilityStatus || "");
      if (!allowed.includes(status)) return fail("Invalid availability status");
      await prisma.provider.update({
        where: { id: provider.id },
        data: { availabilityStatus: status, status: provider.status === "VERIFIED" ? "ACTIVE" : provider.status },
      });
      return ok({ availabilityStatus: status });
    }
    case "accept":
    case "reject": {
      try {
        const bookingId = String(b.bookingId || "");
        const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking || booking.providerId !== provider.id) return fail("Not your booking", 403);
        const updated = await moveStatus(bookingId, action === "accept" ? "ACCEPTED" : "REJECTED");
        if (action === "accept") {
          await prisma.provider.update({ where: { id: provider.id }, data: { acceptedRequests: { increment: 1 } } });
          await notifyUser(booking.customerId, "Request accepted", `${provider.businessName} accepted your request (${booking.code}). Pay to confirm.`, "/bookings", "SUCCESS");
        } else {
          await notifyUser(booking.customerId, "Request declined", `${provider.businessName} couldn't accept ${booking.code}. Try another option nearby.`, "/bookings", "WARN");
        }
        return ok({ booking: { id: updated.id, status: updated.status } });
      } catch (e: any) {
        return fail(e?.message || "Action failed", 400);
      }
    }
    case "en_route": {
      try {
        const bookingId = String(b.bookingId || "");
        const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking || booking.providerId !== provider.id) return fail("Not your booking", 403);
        const updated = await moveStatus(bookingId, "EN_ROUTE");
        return ok({ booking: { id: updated.id, status: updated.status } });
      } catch (e: any) {
        return fail(e?.message || "Action failed", 400);
      }
    }
    case "start": {
      try {
        const bookingId = String(b.bookingId || "");
        const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking || booking.providerId !== provider.id) return fail("Not your booking", 403);
        if (!b.pickupPhotoUrl) return fail("Pickup photo evidence is required to start the trip");
        const updated = await startTrip(bookingId, b.otp ? String(b.otp) : null, String(b.pickupPhotoUrl));
        return ok({ booking: { id: updated.id, status: updated.status }, otpVerified: true });
      } catch (e: any) {
        return fail(e?.message || "Could not start the trip", 400);
      }
    }
    case "complete": {
      try {
        const bookingId = String(b.bookingId || "");
        const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking || booking.providerId !== provider.id) return fail("Not your booking", 403);
        if (!b.dropoffPhotoUrl) return fail("Drop-off photo evidence is required to complete the trip");
        const updated = await completeTrip(bookingId, b.otp ? String(b.otp) : null, String(b.dropoffPhotoUrl));
        return ok({ booking: { id: updated.id, status: updated.status }, otpVerified: true });
      } catch (e: any) {
        return fail(e?.message || "Could not complete the trip", 400);
      }
    }
    case "cancel_trip": {
      try {
        const bookingId = String(b.bookingId || "");
        const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
        if (!booking || booking.providerId !== provider.id) return fail("Not your booking", 403);
        if (!["ACCEPTED", "CONFIRMED"].includes(booking.status)) return fail("Cannot cancel this booking now", 400);
        const updated = await moveStatus(bookingId, "CANCELLED");
        await prisma.booking.update({ where: { id: bookingId }, data: { cancelReason: b.reason ? String(b.reason) : "Cancelled by provider", cancelledAt: new Date() } });
        await notifyUser(booking.customerId, "Booking cancelled", `${booking.code} was cancelled by the provider.`, "/bookings", "WARN");
        return ok({ booking: { id: updated.id, status: updated.status } });
      } catch (e: any) {
        return fail(e?.message || "Could not cancel the booking", 400);
      }
    }
    case "update_pricing": {
      const ruleId = String(b.ruleId || "");
      const rule = await prisma.pricingRule.findUnique({ where: { id: ruleId } });
      if (!rule || rule.ownerProviderId !== provider.id) return fail("Not your pricing rule", 403);
      const fields = ["dailyRate","hourlyRate","perKm","perTrip","perAcre","minAcres","includedKmPerDay","extraPerKm","deposit","visitCharge","travelCharge","minCharge"] as const;
      const data: Record<string, number | null> = {};
      for (const f of fields) {
        if (b.pricing && f in b.pricing) data[f] = b.pricing[f] === null ? null : Number(b.pricing[f]);
      }
      await prisma.pricingRule.update({ where: { id: ruleId }, data });
      return ok({ updated: true });
    }
    case "update_garage": {
      const g = b.garage || {};
      const profile = await prisma.garageProfile.findUnique({ where: { providerId: provider.id } });
      if (!profile) return fail("No garage profile found for this account", 404);
      const services = Array.isArray(g.services) ? g.services.slice(0, 12).map(String) : [];
      await prisma.garageProfile.update({
        where: { providerId: provider.id },
        data: {
          services: JSON.stringify(services.length ? services : ["MECHANIC"]),
          open24x7: !!g.open24x7,
          opensAt: g.opensAt ? String(g.opensAt) : null,
          closesAt: g.closesAt ? String(g.closesAt) : null,
          pickupDrop: typeof g.pickupDrop === "boolean" ? g.pickupDrop : profile.pickupDrop,
        },
      });
      if (g.visitCharge != null && Number(g.visitCharge) > 0) {
        await prisma.pricingRule.updateMany({
          where: { ownerProviderId: provider.id, targetType: "GARAGE_SERVICE", active: true },
          data: { visitCharge: Number(g.visitCharge) },
        });
      }
      return ok({ updated: true });
    }
    default:
      return fail("Unknown action");
  }
}