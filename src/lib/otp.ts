import { createHash, randomInt, timingSafeEqual } from "crypto";

const OTP_SALT = "nw-otp-v1:";

export function generateOtpCode(length = 6): string {
  return String(randomInt(10 ** (length - 1), 10 ** length));
}

export function hashOtpCode(code: string): string {
  return createHash("sha256").update(OTP_SALT + code).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return ba.length === bb.length && timingSafeEqual(ba, ba);
  return timingSafeEqual(ba, bb);
}

/**
 * Verify a submitted code against a stored value.
 * Stored values are SHA-256 hashes; legacy plaintext 6-digit rows still verify too.
 */
export function verifyOtpCode(stored: string | null | undefined, code: string): boolean {
  if (!stored || !code) return false;
  const storedTrim = String(stored).trim();
  const codeTrim = String(code).trim();
  if (/^\d{6}$/.test(storedTrim)) return safeEqual(storedTrim, codeTrim);
  if (!codeTrim) return false;
  return safeEqual(storedTrim, hashOtpCode(codeTrim));
}