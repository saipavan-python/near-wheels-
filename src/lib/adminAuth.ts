import { getSession } from "./session";
import { prisma } from "./db";

export interface AdminContext {
  userId: string;
  name: string | null;
  role: string;
}

/**
 * Admin gate backed by the DB, not just the (possibly stale) session token.
 * The HMAC token is tamper-proof but carries the role snapshot from login
 * time; a demoted/suspended admin must not keep privileges for 30 days.
 */
export async function requireAdmin(): Promise<AdminContext | null> {
  const s = await getSession();
  if (!s) return null;
  const user = await prisma.user.findUnique({
    where: { id: s.userId },
    select: { id: true, name: true, role: true, status: true },
  });
  if (!user || user.role !== "ADMIN" || user.status !== "ACTIVE") return null;
  return { userId: user.id, name: user.name, role: "ADMIN" };
}