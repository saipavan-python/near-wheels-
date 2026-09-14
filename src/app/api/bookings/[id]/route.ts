import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/db";
import {
  getPublicBooking,
  cancelBooking,
  moveStatus,
  completeBooking,
} from "@/lib/services/bookingService";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const session = getSession();
  if (!session) return fail("Login required", 401);
  const booking = await getPublicBooking(ctx.params.id);
  if (!booking) return fail("Booking not found", 404);
  // Ownership check: customer owner, provider owner, or admin
  const isAdmin = session.role === "ADMIN";
  const isCustomerOwner = (booking as any).customerId === session.userId;
  let isProviderOwner = false;
  if (session.role === "PROVIDER") {
    const provider = await prisma.provider.findFirst({ where: { userId: session.userId } });
    isProviderOwner = !!provider && (booking as any).providerId === provider.id;
  }
  if (!isCustomerOwner && !isProviderOwner && !isAdmin) return fail("Not your booking", 403);
  return ok({ booking });
}

/** State transitions with role checks (customer / provider / admin). */
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const session = getSession();
  if (!session) return fail("Login required", 401);
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "");
  const booking = await getPublicBooking(ctx.params.id);
  if (!booking) return fail("Booking not found", 404);

  const isCustomerOwner = session.role === "CUSTOMER" && (booking as any).customerId === session.userId;
  const isAdmin = session.role === "ADMIN";
  let isProviderOwner = false;
  if (session.role === "PROVIDER") {
    const provider = await prisma.provider.findFirst({ where: { userId: session.userId } });
    isProviderOwner = !!provider && provider.id === (booking as any).providerId;
    void prisma;
  }
  if (!isCustomerOwner && !isAdmin && !isProviderOwner) return fail("Not your booking", 403);

  try {
    switch (action) {
      case "cancel":
        if (!isCustomerOwner && !isAdmin) return fail("Only the customer can cancel", 403);
        return ok({ booking: publicize(await cancelBooking(booking.id, session.role, b.reason)) });
      case "accept":
        return ok({ booking: publicize(await moveStatus(booking.id, "ACCEPTED")) });
      case "reject":
        return ok({ booking: publicize(await moveStatus(booking.id, "REJECTED")) });
      case "en_route":
        return ok({ booking: publicize(await moveStatus(booking.id, "EN_ROUTE")) });
      case "start":
        return ok({ booking: publicize(await moveStatus(booking.id, "IN_PROGRESS")) });
      case "complete":
        return ok({ booking: publicize(await completeBooking(booking.id)) });
      default:
        return fail("Unknown action");
    }
  } catch (e: any) {
    return fail(e?.message || "Transition failed", 400);
  }
}

function publicize(b: any) {
  const { priceBreakdownJson, ...rest } = b;
  void priceBreakdownJson;
  return rest;
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } }) {
  const session = getSession();
  if (!session) return fail("Login required", 401);
  const booking = await getPublicBooking(ctx.params.id);
  if (!booking) return fail("Booking not found", 404);
  const isAdmin = session.role === "ADMIN";
  const isCustomerOwner = (booking as any).customerId === session.userId;
  let isProviderOwner = false;
  if (session.role === "PROVIDER") {
    const provider = await prisma.provider.findFirst({ where: { userId: session.userId } });
    isProviderOwner = !!provider && (booking as any).providerId === provider.id;
  }
  if (!isAdmin && !isCustomerOwner && !isProviderOwner) return fail("Not your booking", 403);
  if ((booking as any).status === "COMPLETED") return fail("Cannot delete a completed booking", 400);
  await prisma.booking.delete({ where: { id: ctx.params.id } });
  return ok({ deleted: true });
}
