import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const session = getSession();
  if (!session) return fail("Login required", 401);

  const booking = await prisma.booking.findUnique({
    where: { id: ctx.params.id },
    include: {
      provider: { select: { businessName: true, phone: true, addressText: true } },
      customer: { select: { name: true, phone: true, email: true } },
    },
  });
  if (!booking) return fail("Booking not found", 404);

  // Only participants can see contact, and only when CONFIRMED (or later)
  const isCustomer = booking.customerId === session.userId;
  const isProviderOwner = await (async () => {
    if (session.role === "PROVIDER") {
      const p = await prisma.provider.findFirst({ where: { userId: session.userId } });
      return !!p && p.id === booking.providerId;
    }
    return false;
  })();
  const isAdmin = session.role === "ADMIN";

  if (!isCustomer && !isProviderOwner && !isAdmin) return fail("Not your booking", 403);

  // Contact hidden before CONFIRMED
  const allowedStatuses = ["CONFIRMED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED"];
  if (!allowedStatuses.includes(booking.status) && !isAdmin) {
    return ok({
      allowed: false,
      message: "Contact details will be available after admin confirms the booking.",
      status: booking.status,
    });
  }

  // Return minimal permitted contact
  if (isCustomer || isAdmin) {
    // Customer sees provider contact
    return ok({
      allowed: true,
      provider: {
        businessName: booking.provider.businessName,
        phone: booking.provider.phone,
        addressText: booking.provider.addressText,
      },
      bookingCode: booking.code,
      status: booking.status,
    });
  } else {
    // Provider sees customer contact
    return ok({
      allowed: true,
      customer: {
        name: booking.customer.name,
        phone: booking.customer.phone,
        email: booking.customer.email,
      },
      bookingCode: booking.code,
      status: booking.status,
    });
  }
}
