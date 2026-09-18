import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { hashPassword, validatePasswordStrength } from "@/lib/password";
import { generateOtpCode, hashOtpCode, verifyOtpCode } from "@/lib/otp";
import { sendOtpSms } from "@/lib/sms";
import { audit } from "@/lib/services/auditService";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

/**
 * Forgot password — step 1: request an OTP for a registered mobile number.
 * Always returns the same message whether or not the account exists
 * (prevents account enumeration). Only registered accounts get an OTP sent.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rlIp = checkRateLimit(`forgot:send:ip:${ip}`, 10, 60_000);
  if (!rlIp.allowed) return fail("Too many requests. Try again shortly.", 429);

  const b = await req.json().catch(() => ({}));
  const phone = String((b as any).phone || "").replace(/\D/g, "");
  if (phone.length < 10) return fail("Enter a valid 10-digit mobile number");

  const rlPhone = checkRateLimit(`forgot:send:phone:${phone}`, 3, 60_000);
  if (!rlPhone.allowed) return fail("Too many requests for this number. Wait a minute.", 429);

  const user = await prisma.user.findUnique({ where: { phone } });
  if (user && user.status === "ACTIVE") {
    const recentCount = await prisma.otpCode.count({
      where: { phone, createdAt: { gte: new Date(Date.now() - 15 * 60_000) } },
    });
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
      console.warn("Forgot-password OTP send failed, continuing in dev mode:", (sendErr as Error).message);
    }
    await audit("SYSTEM", user.id, "PASSWORD_FORGOT_REQUEST", "User", user.id, { via: "otp" });
  }

  // Generic response — do not reveal whether the number is registered.
  const isDev = process.env.NODE_ENV !== "production";
  return ok({
    sent: true,
    message: isDev
      ? "Development mode: OTP shown in the server console instead of SMS."
      : "If this number is registered, an OTP has been sent by SMS.",
  });
}

/**
 * Forgot password — step 2: verify the OTP and set a new password.
 */
export async function PUT(req: NextRequest) {
  const ip = getClientIp(req);
  const rlIp = checkRateLimit(`forgot:verify:ip:${ip}`, 20, 60_000);
  if (!rlIp.allowed) return fail("Too many attempts. Try again shortly.", 429);

  const b = await req.json().catch(() => ({}));
  const phone = String((b as any).phone || "").replace(/\D/g, "");
  const code = String((b as any).code || "").trim();
  const newPassword = String((b as any).newPassword || "");
  if (!phone || phone.length < 10) return fail("Enter a valid 10-digit mobile number");
  if (!code) return fail("Enter the OTP sent to your number");

  const rlPhone = checkRateLimit(`forgot:verify:phone:${phone}`, 5, 60_000);
  if (!rlPhone.allowed) return fail("Too many attempts for this number. Try again shortly.", 429);

  const pwErr = validatePasswordStrength(newPassword);
  if (pwErr) return fail(pwErr);

  const otp = await prisma.otpCode.findFirst({
    where: { phone, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || !verifyOtpCode(otp.code, code)) return fail("That OTP is invalid or expired");

  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user || user.status !== "ACTIVE") return fail("That OTP is invalid or expired");

  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword) } });

  await audit("SYSTEM", user.id, "PASSWORD_RESET", "User", user.id, { via: "otp" });

  return ok({ sent: true, message: "Password updated. You can now log in with your new password." });
}