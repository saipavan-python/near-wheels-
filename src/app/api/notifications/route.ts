import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Notifications API. Scope = the signed-in user's own notifications PLUS every
 * provider org they own or belong to (so providers get booking alerts here too).
 *
 * GET  -> { notifications, unreadCount }
 * POST -> mark all read in scope (called when the notification drawer opens,
 *         which is what stops the repeated alert).
 */
async function scopeWhere(userId: string, providerIds: string[]) {
  if (!providerIds.length) return { userId };
  return { OR: [{ userId }, { providerId: { in: providerIds } }] };
}

async function resolveScope(sessionUserId: string) {
  const providers = await prisma.provider.findMany({
    where: { userId: sessionUserId },
    select: { id: true },
  });
  return scopeWhere(sessionUserId, providers.map((p) => p.id));
}

export async function GET() {
  const s = await getSession();
  if (!s) return fail("Login required", 401);

  const where = await resolveScope(s.userId);
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 60 }),
    prisma.notification.count({ where: { ...where, isRead: false } }),
  ]);

  return ok({ notifications, unreadCount });
}

export async function POST() {
  const s = await getSession();
  if (!s) return fail("Login required", 401);

  const where = await resolveScope(s.userId);
  const r = await prisma.notification.updateMany({
    where: { ...where, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  return ok({ markedRead: r.count });
}
export const dynamic = "force-dynamic";