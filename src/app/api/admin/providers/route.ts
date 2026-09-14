import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { audit } from "@/lib/services/auditService";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

function requireAdmin() {
  const s = getSession();
  return s && s.role === "ADMIN" ? s : null;
}

function requireAdminRateLimit(req: NextRequest): boolean {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`admin-action:${ip}`, 20, 60_000);
  if (!rl.allowed) return false;
  return true;
}

export async function GET(req: NextRequest) {
  if (!requireAdmin()) return fail("Admin only", 403);
  const status = req.nextUrl.searchParams.get("status");
  const providers = await prisma.provider.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      vehicles: { select: { id: true, title: true, make: true, model: true, category: true, status: true, seats: true, imageUrl: true } },
    },
  });
  return ok({ providers });
}

const ACTIONS = ["approve", "reject", "suspend", "activate", "verify", "set_offline"] as const;

export async function PATCH(req: NextRequest) {
  const session = requireAdmin();
  if (!session) return fail("Admin only", 403);
  if (!requireAdminRateLimit(req)) return fail("Too many admin actions. Try again.", 429);
  const b = await req.json().catch(() => ({}));
  const action = String(b.action || "");
  const id = String(b.providerId || "");
  if (!ACTIONS.includes(action as any)) return fail("Unknown action");
  const provider = await prisma.provider.findUnique({ where: { id } });
  if (!provider) return fail("Provider not found", 404);

  const map: Record<string, { status?: string; isVerified?: boolean; availabilityStatus?: string }> = {
    approve: { status: "ACTIVE", availabilityStatus: "AVAILABLE_NOW" },
    reject: { status: "REJECTED" },
    suspend: { status: "SUSPENDED", availabilityStatus: "OFFLINE" },
    activate: { status: "ACTIVE", availabilityStatus: "AVAILABLE_NOW" },
    verify: { isVerified: true, status: provider.status === "PENDING_VERIFICATION" ? "ACTIVE" : provider.status, availabilityStatus: "AVAILABLE_NOW" },
    set_offline: { availabilityStatus: "OFFLINE" },
  };

  const updated = await prisma.provider.update({ where: { id }, data: map[action] });
  // approving a provider activates their listings too
  if (action === "approve" || action === "verify") {
    await prisma.vehicle.updateMany({ where: { providerId: id, status: "PENDING_VERIFICATION" }, data: { status: "ACTIVE" } });
  }
  await audit("ADMIN", session.userId, `PROVIDER_${action.toUpperCase()}`, "Provider", id, {
    businessName: updated.businessName,
  });
  return ok({ provider: { id: updated.id, status: updated.status, isVerified: updated.isVerified } });
}

export async function DELETE(req: NextRequest) {
  const admin = requireAdmin();
  if (!admin) return fail("Admin only", 403);
  if (!requireAdminRateLimit(req)) return fail("Too many admin actions. Try again.", 429);
  const b = await req.json().catch(() => ({}));
  const ids = b.ids || [];
  if (!Array.isArray(ids) || ids.length === 0) return fail("ids array required", 400);
  for (const id of ids) {
    const provider = await prisma.provider.findUnique({ where: { id } });
    if (provider && provider.status !== "ACTIVE") {
      await prisma.provider.delete({ where: { id } });
      await audit("ADMIN", admin.userId, "PROVIDER_DELETE", "Provider", id, {});
    }
  }
  return ok({ deleted: true });
}
