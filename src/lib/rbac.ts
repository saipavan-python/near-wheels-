// RBAC foundation — provider and admin roles with granular permissions
// Follows provider vs admin separation, staff invitation, multiple roles union

export const PROVIDER_ROLES = ["OWNER", "FLEET_MANAGER", "BOOKING_MANAGER", "FINANCE_MANAGER", "STAFF"] as const;
export type ProviderRole = typeof PROVIDER_ROLES[number];

export const ADMIN_ROLES = ["ADMIN", "OPERATIONS_ADMIN", "FINANCE_ADMIN", "SUPPORT_ADMIN", "MODERATION_ADMIN", "ANALYTICS_ADMIN"] as const;
export type AdminRole = typeof ADMIN_ROLES[number];

// Permission definitions
export const PERMISSIONS = [
  "assets.read",
  "assets.create",
  "assets.update",
  "assets.delete",
  "availability.read",
  "availability.update",
  "bookings.read",
  "bookings.create",
  "bookings.update",
  "bookings.confirm",
  "bookings.cancel",
  "drivers.read",
  "drivers.manage",
  "services.read",
  "services.manage",
  "payments.read",
  "payments.manage",
  "payouts.read",
  "messages.read",
  "messages.send",
  "analytics.read",
  "staff.read",
  "staff.invite",
  "staff.manage",
  "settings.manage",
] as const;
export type Permission = typeof PERMISSIONS[number];

// Role -> permissions mapping (union for multiple roles)
export const PROVIDER_ROLE_PERMISSIONS: Record<ProviderRole, Permission[]> = {
  OWNER: [...PERMISSIONS],
  FLEET_MANAGER: ["assets.read", "assets.create", "assets.update", "availability.read", "availability.update", "bookings.read"],
  BOOKING_MANAGER: ["bookings.read", "bookings.create", "bookings.update", "bookings.confirm", "bookings.cancel", "messages.read", "messages.send", "assets.read", "availability.read"],
  FINANCE_MANAGER: ["payments.read", "payments.manage", "payouts.read", "bookings.read", "analytics.read"],
  STAFF: ["assets.read", "availability.read", "bookings.read", "messages.read"],
};

// Admin role permissions (simplified) — unified: ADMIN replaces SUPER_ADMIN (single super admin)
export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  ADMIN: [...PERMISSIONS, "staff.manage", "settings.manage"],
  OPERATIONS_ADMIN: ["bookings.read", "bookings.confirm", "bookings.cancel", "assets.read", "availability.read", "messages.read"],
  FINANCE_ADMIN: ["payments.read", "payments.manage", "payouts.read", "analytics.read"],
  SUPPORT_ADMIN: ["bookings.read", "messages.read", "messages.send"],
  MODERATION_ADMIN: ["assets.read", "assets.update", "bookings.read"],
  ANALYTICS_ADMIN: ["analytics.read", "bookings.read", "assets.read"],
};

export function hasProviderPermission(userRoles: ProviderRole[], permission: Permission): boolean {
  const perms = new Set<Permission>();
  for (const r of userRoles) {
    const list = PROVIDER_ROLE_PERMISSIONS[r] || [];
    for (const p of list) perms.add(p);
  }
  return perms.has(permission);
}

export function hasAdminPermission(userRoles: AdminRole[], permission: Permission): boolean {
  const perms = new Set<Permission>();
  for (const r of userRoles) {
    const list = ADMIN_ROLE_PERMISSIONS[r] || [];
    for (const p of list) perms.add(p);
  }
  return perms.has(permission);
}

// Check if user is member of provider with required permission
export async function checkProviderAccess(prisma: any, userId: string, providerId: string, permission: Permission): Promise<boolean> {
  // Owner via Provider.userId
  const provider = await prisma.provider.findUnique({ where: { id: providerId } });
  if (!provider) return false;
  if (provider.userId === userId) return true; // owner has all
  const membership = await prisma.providerMember.findUnique({ where: { providerId_userId: { providerId, userId } } });
  if (!membership) return false;
  return hasProviderPermission([membership.role as ProviderRole], permission);
}
