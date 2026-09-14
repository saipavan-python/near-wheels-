import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

async function isParticipant(booking: any, session: any): Promise<{ ok: boolean; role: string | null }> {
  if (booking.customerId === session.userId) return { ok: true, role: "CUSTOMER" };
  if (session.role === "PROVIDER") {
    const p = await prisma.provider.findFirst({ where: { userId: session.userId } });
    if (p && p.id === booking.providerId) return { ok: true, role: "PROVIDER" };
  }
  if (session.role === "ADMIN") return { ok: true, role: "ADMIN" };
  return { ok: false, role: null };
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const session = getSession();
  if (!session) return fail("Login required", 401);

  const booking = await prisma.booking.findUnique({ where: { id: ctx.params.id } });
  if (!booking) return fail("Booking not found", 404);

  const participant = await isParticipant(booking, session);
  if (!participant.ok) return fail("Not your booking", 403);

  // Chat only allowed when CONFIRMED or later (or ADMIN)
  const allowedStatuses = ["CONFIRMED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED"];
  if (!allowedStatuses.includes(booking.status) && session.role !== "ADMIN") {
    return fail("Chat is available after booking is confirmed by admin", 403);
  }

  const messages = await prisma.bookingChatMessage.findMany({
    where: { bookingId: booking.id },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  // Simple unread: count messages where sender != me and created in last fetch? For MVP, just return all
  return ok({
    booking: { id: booking.id, code: booking.code, status: booking.status, listingTitle: booking.listingTitle, scheduledFor: booking.scheduledFor },
    messages: messages.map((m) => ({
      id: m.id,
      text: m.text,
      senderRole: m.senderRole,
      isMine: m.senderId === session.userId,
      createdAt: m.createdAt,
    })),
  });
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const session = getSession();
  if (!session) return fail("Login required", 401);

  const ip = getClientIp(req);
  const rl = checkRateLimit(`chat:${session.userId}:${ip}`, 20, 60_000);
  if (!rl.allowed) return fail("Too many messages", 429);

  const booking = await prisma.booking.findUnique({ where: { id: ctx.params.id } });
  if (!booking) return fail("Booking not found", 404);

  const participant = await isParticipant(booking, session);
  if (!participant.ok) return fail("Not your booking", 403);

  const allowedStatuses = ["CONFIRMED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED"];
  if (!allowedStatuses.includes(booking.status) && session.role !== "ADMIN") {
    return fail("Chat is available after booking is confirmed", 403);
  }

  const b = await req.json().catch(() => ({}));
  const text = String(b.text || "").trim().slice(0, 1000);
  if (!text) return fail("Message cannot be empty", 400);

  const msg = await prisma.bookingChatMessage.create({
    data: {
      bookingId: booking.id,
      senderId: session.userId,
      senderRole: participant.role === "ADMIN" ? "ADMIN" : participant.role!,
      text,
    },
  });

  // Notify other participant
  try {
    const { notifyUser, notifyProvider } = await import("@/lib/services/notificationService");
    if (participant.role === "CUSTOMER") {
      await notifyProvider(booking.providerId, "New message", `New message for ${booking.code}: ${text.slice(0, 60)}`, `/bookings/${booking.id}`, "INFO");
    } else if (participant.role === "PROVIDER") {
      await notifyUser(booking.customerId, "New message", `Provider reply for ${booking.code}: ${text.slice(0, 60)}`, `/bookings/${booking.id}`, "INFO");
    }
  } catch {}

  return ok({ message: { id: msg.id, text: msg.text, senderRole: msg.senderRole, createdAt: msg.createdAt } }, { status: 201 });
}
