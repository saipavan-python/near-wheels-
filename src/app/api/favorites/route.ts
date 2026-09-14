import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  const session = getSession();
  if (!session) return ok({ favorites: [] });
  const favs = await prisma.favorite.findMany({
    where: { customerId: session.userId },
    include: { provider: { select: { id: true, businessName: true, type: true, ratingAvg: true } } },
  });
  return ok({ favorites: favs.map((f) => ({ id: f.id, provider: f.provider, label: f.label })) });
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return fail("Login required", 401);
  const b = await req.json().catch(() => ({}));
  const providerId = String(b.providerId || "");
  if (!providerId) return fail("providerId required");
  const existing = await prisma.favorite.findUnique({
    where: { customerId_providerId: { customerId: session.userId, providerId } },
  });
  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return ok({ favorited: false });
  }
  await prisma.favorite.create({ data: { customerId: session.userId, providerId, label: b.label || null } });
  return ok({ favorited: true });
}

export async function DELETE(req: NextRequest) {
  const session = getSession();
  if (!session) return fail("Login required", 401);
  const b = await req.json().catch(() => ({}));
  const favoriteId = String(b.favoriteId || "");
  if (!favoriteId) return fail("favoriteId required", 400);
  const fav = await prisma.favorite.findUnique({ where: { id: favoriteId } });
  if (!fav || fav.customerId !== session.userId) return fail("Not authorized", 403);
  await prisma.favorite.delete({ where: { id: favoriteId } });
  return ok({ deleted: true });
}
