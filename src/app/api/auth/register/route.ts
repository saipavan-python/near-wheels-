import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { createSessionToken, sessionCookieOptions } from "@/lib/session";
import { hashPassword, validatePasswordStrength } from "@/lib/password";
import { audit } from "@/lib/services/auditService";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`register:${ip}`, 5, 60 * 60_000);
  if (!rl.allowed) return fail("Too many registrations. Try again later.", 429);

  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim().slice(0, 60) || null;
  const emailRaw = b.email ? String(b.email).trim().toLowerCase() : null;
  const phoneRaw = b.phone ? String(b.phone).replace(/\D/g, "") : null;
  const password = String(b.password || "");
  const requestedRole = String(b.role || "CUSTOMER").toUpperCase();

  // Validate role server-side: only allow CUSTOMER or PROVIDER (ADMIN never via this endpoint)
  const role = requestedRole === "PROVIDER" ? "PROVIDER" : "CUSTOMER";

  if (!phoneRaw && !emailRaw) return fail("Email or phone is required");
  if (emailRaw && !isValidEmail(emailRaw)) return fail("Invalid email format");
  if (phoneRaw && phoneRaw.length < 10) return fail("Phone must be 10 digits");
  if (!password) return fail("Password is required");
  const pwErr = validatePasswordStrength(password);
  if (pwErr) return fail(pwErr);

  // Check duplicates
  if (emailRaw) {
    const existsEmail = await prisma.user.findUnique({ where: { email: emailRaw } });
    if (existsEmail) return fail("An account with this email already exists. Try logging in.", 409);
  }
  if (phoneRaw) {
    const existsPhone = await prisma.user.findUnique({ where: { phone: phoneRaw } });
    if (existsPhone) return fail("An account with this phone already exists. Try logging in.", 409);
  }

  const passwordHash = hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email: emailRaw,
      phone: phoneRaw,
      passwordHash,
      role,
      emailVerified: false,
    },
  });

  await audit("SYSTEM", user.id, "SIGNUP_PASSWORD", "User", user.id, { via: emailRaw ? "email" : "phone", role });

  const token = createSessionToken({ userId: user.id, role: user.role, name: user.name || undefined });
  const res = ok({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role } }, { status: 201 });
  res.cookies.set(sessionCookieOptions().name, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: sessionCookieOptions().maxAge,
    path: "/",
  });
  return res;
}
