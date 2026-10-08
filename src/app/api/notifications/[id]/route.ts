import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

/** PATCH /api/notifications/[id] — mark a single notification as read. */
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{  id: string  }> }) {
  const s = await getSession();
  if (!s) return fail("Login required", 401);

  const notif = await prisma.notification.findUnique({ where: { id: (await params).id } });
  if (!notif) return fail("Notification not found", 404);

  const providers = await prisma.provider.findMany({
    where: { userId: s.userId },
    select: { id: true },
  });
  const ownsProvider = notif.providerId != null && providers.some((p) => p.id === notif.providerId);
  if (notif.userId !== s.userId && !ownsProvider) return fail("Not your notification", 403);

  const updated = await prisma.notification.update({
    where: { id: notif.id },
    data: { isRead: true, readAt: new Date() },
  });

  return ok({ notification: updated });
}