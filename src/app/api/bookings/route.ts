import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { ok, fail, num } from "@/lib/http";
import { createBooking, bookingsForCustomer, BookingConflictError } from "@/lib/services/bookingService";

export const runtime = "nodejs";

export async function GET() {
  const session = getSession();
  if (!session) return fail("Login required", 401);
  // Allow any authenticated role to view their own bookings as customer (provider may also book)
  const bookings = await bookingsForCustomer(session.userId);
  return ok({ bookings });
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return fail("Please log in to book. You can continue browsing without an account.", 401);
  const { checkRateLimit, getClientIp } = await import("@/lib/rateLimit");
  const ip = getClientIp(req);
  const rl = checkRateLimit(`booking:${session.userId}:${ip}`, 10, 60_000);
  if (!rl.allowed) return fail("Too many booking attempts. Please wait.", 429);

  const b = await req.json().catch(() => ({}));
  const idempotencyKey =
    req.headers.get("idempotency-key") ||
    (b.idempotencyKey ? String(b.idempotencyKey) : "");

  if (!idempotencyKey) return fail("Missing idempotency key — duplicate protection is mandatory");

  // Progressive registration: if user has no phone, collect it now
  const { prisma } = await import("@/lib/db");
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (user && !user.phone && b.phone) {
    const phone = String(b.phone).replace(/\D/g, "");
    if (phone.length >= 10) {
      try {
        await prisma.user.update({ where: { id: user.id }, data: { phone } });
      } catch {}
    }
  } else if (user && !user.phone && !b.phone) {
    // Allow booking without phone for now, but warn; phone will be required at payment
  }

  try {
    const { booking, idempotentReplay } = await createBooking({
      customerId: session.userId,
      kind: String(b.kind),
      listingKind: b.listingKind,
      listingId: b.listingId ? String(b.listingId) : undefined,
      vehicleId: b.vehicleId ? String(b.vehicleId) : undefined,
      scheduledFor: b.scheduledFor ? String(b.scheduledFor) : null,
      durationDays: num(b.durationDays),
      durationHours: num(b.durationHours),
      acres: num(b.acres),
      estKm: num(b.estKm),
      ac: typeof b.ac === "boolean" ? b.ac : null,
      locationText: b.locationText ? String(b.locationText) : undefined,
      destLat: num(b.destLat),
      destLng: num(b.destLng),
      notes: b.notes ? String(b.notes).slice(0, 300) : "",
      idempotencyKey,
    });

    const { getPublicBooking } = await import("@/lib/services/bookingService");
    const pub = await getPublicBooking(booking.id);
    return ok({ booking: pub, idempotentReplay }, { status: idempotentReplay ? 200 : 201 });
  } catch (e: any) {
    if (e instanceof BookingConflictError)
      return fail("Sorry — that option was just booked by someone else. Here are nearby alternatives.", 409, {
        code: "JUST_BOOKED",
      });
    return fail(e?.message || "Could not create booking", 400);
  }
}
