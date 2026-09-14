import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

function requireAdmin() {
  const s = getSession();
  return s && s.role === "ADMIN" ? s : null;
}

export async function GET(req: NextRequest) {
  if (!requireAdmin()) return fail("Admin only", 403);
  const status = req.nextUrl.searchParams.get("status") || "PENDING";
  const page = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1")));
  const pageSize = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get("pageSize") || "20")));
  const skip = (page - 1) * pageSize;

  const where: any = status === "ALL" ? {} : { status };
  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        customer: { select: { name: true, phone: true, email: true } },
        provider: { select: { businessName: true, phone: true } },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  return ok({ bookings, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

export async function DELETE(req: NextRequest) {
  const admin = requireAdmin();
  if (!admin) return fail("Admin only", 403);
  const ip = getClientIp(req);
  const rl = checkRateLimit(`admin-action:${ip}`, 20, 60_000);
  if (!rl.allowed) return fail("Too many admin actions. Try again.", 429);
  const b = await req.json().catch(() => ({}));
  const ids = b.ids || [];
  if (!Array.isArray(ids) || ids.length === 0) return fail("ids array required", 400);
  for (const id of ids) {
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (booking && booking.status !== "COMPLETED") {
      await prisma.booking.delete({ where: { id } });
    }
  }
  return ok({ deleted: true });
}
