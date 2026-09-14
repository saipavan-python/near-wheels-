import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { ok } from "@/lib/http";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = getSession();
  if (!session) return ok({ user: null, capabilities: [], providerMemberships: [], admin: null });
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return ok({ user: null, capabilities: [], providerMemberships: [], admin: null });

  const unread = await prisma.notification.count({ where: { userId: user.id, readAt: null } });

  // Resolve provider memberships & ownerships
  const ownedProviders = await prisma.provider.findMany({
    where: { userId: user.id },
    select: { id: true, businessName: true, type: true, status: true, isVerified: true },
  });

  const memberRecords = await prisma.providerMember.findMany({
    where: { userId: user.id },
    include: { provider: { select: { id: true, businessName: true, type: true, status: true, isVerified: true } } },
  });

  const ownedDrivingSchools = await prisma.drivingSchool.findMany({
    where: { ownerId: user.id },
    select: { id: true, schoolName: true, status: true },
  });

  const membershipsMap = new Map<string, { providerId: string; role: string; businessName: string; type: string; status: string; isVerified: boolean }>();

  for (const p of ownedProviders) {
    membershipsMap.set(p.id, {
      providerId: p.id,
      role: "OWNER",
      businessName: p.businessName,
      type: p.type,
      status: p.status,
      isVerified: p.isVerified,
    });
  }

  for (const pm of memberRecords) {
    if (!membershipsMap.has(pm.providerId) && pm.provider) {
      membershipsMap.set(pm.providerId, {
        providerId: pm.providerId,
        role: pm.role,
        businessName: pm.provider.businessName,
        type: pm.provider.type,
        status: pm.provider.status,
        isVerified: pm.provider.isVerified,
      });
    }
  }

  const providerMemberships = Array.from(membershipsMap.values());

  // Capabilities
  const capabilities: string[] = ["CUSTOMER"];
  if (providerMemberships.length > 0 || ownedDrivingSchools.length > 0 || user.role === "PROVIDER") {
    capabilities.push("PROVIDER");
  }
  if (user.role === "ADMIN") {
    capabilities.push("ADMIN");
  }

  const admin = user.role === "ADMIN" ? { isSuperAdmin: true, role: "SUPER_ADMIN" } : null;

  return ok({
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
    capabilities,
    providerMemberships,
    admin,
    unreadNotifications: unread,
  });
}

export async function DELETE() {
  cookies().delete("nw_session");
  return ok({ loggedOut: true });
}
