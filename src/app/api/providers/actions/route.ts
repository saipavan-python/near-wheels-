import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/db";
import { moveStatus } from "@/lib/services/bookingService";
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
    }
    case "en_route":
    case "start":
    case "complete": {
      const bookingId = String(b.bookingId || "");
      const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
      if (!booking || booking.providerId !== provider.id) return fail("Not your booking", 403);
      const target = action === "en_route" ? "EN_ROUTE" : action === "start" ? "IN_PROGRESS" : "COMPLETED";
      const updated =
        target === "COMPLETED"
          ? await (await import("@/lib/services/bookingService")).completeBooking(bookingId)
          : await moveStatus(bookingId, target);
      return ok({ booking: { id: updated.id, status: updated.status } });
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
    default:
      return fail("Unknown action");
  }
}
