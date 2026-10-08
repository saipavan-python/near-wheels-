import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { ok, fail } from "@/lib/http";
import { getPublicBooking } from "@/lib/services/bookingService";

export const runtime = "nodejs";

/**
 * Live trip-status poll — returns the public booking snapshot for the
 * signed-in customer, guarded by ownership. Lightweight (no LLM).
 * Used by the chat widget to auto-refresh booking status while a trip
 * is live (RedBus-style trip tracking).
 */
export async function GET(req: NextRequest) {
  try {
    const code = (req.nextUrl.searchParams.get("code") || "").trim().toUpperCase();
    if (!code) return fail("Booking code required", 400);

    const session = await getSession();
    if (!session || (session.role !== "CUSTOMER" && session.role !== "ADMIN")) {
      return fail("Login required", 401);
    }

    const booking = await getPublicBooking(code);
    if (!booking) return fail("Booking not found", 404);
    if (booking.customerId !== session.userId && session.role !== "ADMIN") {
      return fail("Not your booking", 403);
    }

    return ok({ booking });
  } catch (e: any) {
    console.error("trip-status error:", e?.message || "unknown");
    return fail("Could not fetch trip status", 500);
  }
}
export const dynamic = "force-dynamic";