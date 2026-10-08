import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { createSessionToken, sessionCookieOptions } from "@/lib/session";
import { audit } from "@/lib/services/auditService";
import { generateOtpCode, hashOtpCode, verifyOtpCode } from "@/lib/otp";
import { sendOtpSms } from "@/lib/sms";

export const runtime = "nodejs";

let lastOtpPurge = 0;

/** Request an OTP (dev mode returns the code so the demo is usable). */
export async function POST(req: NextRequest) {
  const now = Date.now();
  if (now - lastOtpPurge > 60_000) {
    lastOtpPurge = now;
    await prisma.otpCode.deleteMany({ where: { consumed: true } }).catch(() => undefined);
  }
  const { checkRateLimit, getClientIp } = await import("@/lib/rateLimit");
  const ip = getClientIp(req);
  const b0 = await req.json().catch(() => ({}));
  const phone0 = String((b0 as any).phone || "").replace(/\D/g, "");
  // Rate limit per IP and per phone
  const rlIp = checkRateLimit(`otp:send:ip:${ip}`, 10, 60_000);
  if (!rlIp.allowed) return fail("Too many OTP requests. Try again shortly.", 429);
  if (phone0) {
    const rlPhone = checkRateLimit(`otp:send:phone:${phone0}`, 3, 60_000);
    if (!rlPhone.allowed) return fail("Too many OTP requests for this number. Wait a minute.", 429);
  }
  const b = b0;
  const phone = String(b.phone || "").replace(/\D/g, "");
  if (phone.length < 10) return fail("Enter a valid 10-digit mobile number");

  // Limit to 5 OTPs per phone per 15 minutes
  const recentCount = await prisma.otpCode.count({ where: { phone, createdAt: { gte: new Date(Date.now() - 15 * 60_000) } } });
  if (recentCount >= 5) return fail("Too many OTPs for this number. Try again after 15 minutes.", 429);

  const code = generateOtpCode();
  await prisma.otpCode.create({
    data: { phone, code: hashOtpCode(code), expiresAt: new Date(Date.now() + 5 * 60_000) },
  });

  try {
    await sendOtpSms(phone, code);
  } catch (sendErr) {
    if (process.env.NODE_ENV === "production") {
      return fail("SMS service is not configured. Please try again later.", 503);
    }
    console.warn("OTP send failed, continuing in dev mode:", (sendErr as Error).message);
  }

  const isDev = process.env.NODE_ENV !== "production";
  return ok({
    sent: true,
    ...(isDev ? { devCode: code } : {}),
    message: isDev
      ? "Development mode: OTP shown here instead of SMS."
      : "OTP sent via SMS.",
  });
}

/** Verify OTP → create/find customer → signed session cookie. */
export async function PUT(req: NextRequest) {
  const { checkRateLimit, getClientIp } = await import("@/lib/rateLimit");
  const ip = getClientIp(req);
  const rlIp = checkRateLimit(`otp:verify:ip:${ip}`, 20, 60_000);
  if (!rlIp.allowed) return fail("Too many verification attempts. Try again shortly.", 429);
  const b = await req.json().catch(() => ({}));
  const phone = String(b.phone || "").replace(/\D/g, "");
  const code = String(b.code || "").trim();
  if (!phone || !code) return fail("Phone and OTP are required");

  // Also rate limit per phone for verify
  const rlPhone = checkRateLimit(`otp:verify:phone:${phone}`, 5, 60_000);
  if (!rlPhone.allowed) return fail("Too many attempts for this number. Try again shortly.", 429);

  const otp = await prisma.otpCode.findFirst({
    where: { phone, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || !verifyOtpCode(otp.code, code)) return fail("That OTP is invalid or expired");

  let user = await prisma.user.findUnique({ where: { phone } });
  if (user && user.status !== "ACTIVE") return fail("This account is unavailable. Contact support for help.", 403);
  const claimed = await prisma.otpCode.updateMany({
    where: { id: otp.id, consumed: false, expiresAt: { gt: new Date() } },
    data: { consumed: true },
  });
  if (claimed.count !== 1) return fail("That OTP is invalid or expired");

  if (!user) {
    // Check if there's a Google user with same email and phone missing? For OTP, we create with phone.
    // If a Google user exists with same phone placeholder, link
    user = await prisma.user.create({
      data: { phone, name: b.name ? String(b.name).slice(0, 60) : null, role: "CUSTOMER" },
    });
    await audit("SYSTEM", user.id, "SIGNUP", "User", user.id, { via: "otp" });
  } else {
    // If existing Google user without phone, update phone and link
    if (!user.phone) {
      try {
        user = await prisma.user.update({ where: { id: user.id }, data: { phone } });
      } catch {
        // Phone already taken by another user
        return fail("This phone is already linked to another account. Use a different number or login with Google.", 409);
      }
    }
  }

  const token = createSessionToken({ userId: user.id, role: user.role, name: user.name || undefined });
  const res = ok({ user: { id: user.id, name: user.name, phone: user.phone, role: user.role } });
  res.cookies.set(sessionCookieOptions().name, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: sessionCookieOptions().maxAge,
    path: "/",
  });
  return res;
}
