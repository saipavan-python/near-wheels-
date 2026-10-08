import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { createSessionToken, sessionCookieOptions } from "@/lib/session";
import { verifyPassword } from "@/lib/password";
import { audit } from "@/lib/services/auditService";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`login:ip:${ip}`, 10, 60_000);
  if (!rl.allowed) return fail("Too many login attempts. Try again shortly.", 429);

  const b = await req.json().catch(() => ({}));
  const emailRaw = b.email ? String(b.email).trim().toLowerCase() : null;
  const phoneRaw = b.phone ? String(b.phone).replace(/\D/g, "") : null;
  const identifier = emailRaw || phoneRaw;
  if (!identifier) return fail("Email or phone is required", 400);
  const password = String(b.password || "");
  if (!password) return fail("Password is required", 400);

  // Rate limit per account
  const rlAcc = checkRateLimit(`login:acc:${identifier}`, 5, 60_000);
  if (!rlAcc.allowed) return fail("Too many attempts for this account. Try again shortly.", 429);

  let user = null;
  if (emailRaw) {
    user = await prisma.user.findUnique({ where: { email: emailRaw } });
  } else if (phoneRaw) {
    user = await prisma.user.findUnique({ where: { phone: phoneRaw } });
  }

  if (!user || !user.passwordHash) {
    // Use same message to prevent enumeration
    return fail("Invalid credentials. Check email/phone and password.", 401);
  }

  if (user.status !== "ACTIVE") return fail("This account is unavailable. Contact support for help.", 403);

  const okPw = verifyPassword(password, user.passwordHash);
  if (!okPw) return fail("Invalid credentials. Check email/phone and password.", 401);

  await audit("SYSTEM", user.id, "LOGIN_PASSWORD", "User", user.id, { via: emailRaw ? "email" : "phone" });

  const token = createSessionToken({ userId: user.id, role: user.role, name: user.name || undefined });
  const res = ok({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } });
  res.cookies.set(sessionCookieOptions().name, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: sessionCookieOptions().maxAge,
    path: "/",
  });
  return res;
}
