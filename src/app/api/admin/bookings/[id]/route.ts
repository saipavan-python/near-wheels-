import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/db";
import { moveStatus } from "@/lib/services/bookingService";
import { notifyUser, notifyProvider } from "@/lib/services/notificationService";
import { audit } from "@/lib/services/auditService";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return fail("Admin only", 403);
  const booking = await prisma.booking.findUnique({
    where: { id: ctx.params.id },
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      provider: { select: { id: true, businessName: true, phone: true } },
    },
  });
  if (!booking) return fail("Booking not found", 404);
  return ok({ booking });
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return fail("Admin only", 403);
  const booking = await prisma.booking.findUnique({ where: { id: ctx.params.id } });
  if (!booking) return fail("Booking not found", 404);
  if (booking.status === "COMPLETED") return fail("Cannot delete a completed booking", 400);
  await prisma.booking.delete({ where: { id: ctx.params.id } });
  await audit("ADMIN", admin.userId, "BOOKING_DELETE", "Booking", booking.id, { code: booking.code });
  return ok({ deleted: true });
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return fail("Admin only", 403);
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "").toLowerCase();
  if (!["confirm", "reject", "cancel"].includes(action)) return fail("Invalid action: confirm, reject, cancel", 400);

  const booking = await prisma.booking.findUnique({ where: { id: ctx.params.id } });
  if (!booking) return fail("Booking not found", 404);

  try {
    let nextStatus = "";
    if (action === "confirm") nextStatus = "CONFIRMED";
    else if (action === "reject") nextStatus = "REJECTED";
    else if (action === "cancel") nextStatus = "CANCELLED";

    const updated = await moveStatus(booking.id, nextStatus);

    // Notifications
    if (action === "confirm") {
      await Promise.all([
        notifyUser(booking.customerId, "Booking confirmed", `Your booking ${booking.code} has been confirmed by admin. Provider contact is now available.`, `/bookings`, "SUCCESS"),
        notifyProvider(booking.providerId, "Booking confirmed", `Booking ${booking.code} confirmed by admin.`, `/provider/dashboard`, "SUCCESS"),
      ]);
      // Unlock chat is implicit via status CONFIRMED
    } else if (action === "reject") {
      await notifyUser(booking.customerId, "Booking rejected", `Your booking ${booking.code} was rejected by admin.`, `/bookings`, "WARN");
    }

    await audit("ADMIN", admin.userId, `BOOKING_${action.toUpperCase()}`, "Booking", booking.id, { code: booking.code });

    return ok({ booking: updated });
  } catch (e: any) {
    return fail(e?.message || "Transition failed", 400);
  }
}
