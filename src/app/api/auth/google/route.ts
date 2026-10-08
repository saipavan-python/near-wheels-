import { NextRequest } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { createSessionToken, sessionCookieOptions } from "@/lib/session";
import { audit } from "@/lib/services/auditService";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

function getClientId(): string | null {
  return process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || null;
}

export async function POST(req: NextRequest) {
  // Rate limit: 10 Google attempts per IP per minute
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(`google:${ip}`, 10, 60_000);
  if (!rl.allowed) return fail("Too many attempts. Please try again shortly.", 429);

  const body = await req.json().catch(() => ({}));
  const idToken = String(body.idToken || body.credential || "").trim();
  if (!idToken) return fail("Missing ID token");

  const clientId = getClientId();
  if (!clientId) return fail("Google login is not configured. Set GOOGLE_CLIENT_ID.", 500);

  let payload: any;
  try {
    const verified = await jwtVerify(idToken, JWKS, {
      issuer: GOOGLE_ISSUERS,
      audience: clientId,
    });
    payload = verified.payload;
  } catch (e: any) {
    console.error("Google token verify failed", e?.message);
    return fail("Invalid Google token. Please try again.", 401);
  }

  // Verify email
  const email = String(payload.email || "").toLowerCase().trim();
  const emailVerified = payload.email_verified === true || payload.email_verified === "true";
  const sub = String(payload.sub || "");
  const name = String(payload.name || payload.given_name || "").slice(0, 60) || null;
  const avatarUrl = String(payload.picture || "").slice(0, 500) || null;

  if (!email || !sub) return fail("Google token missing email", 400);
  if (!emailVerified) return fail("Google email not verified. Please verify your Google email first.", 400);

  // Account linking / creation
  // 1) Find by googleId
  let user = await prisma.user.findUnique({ where: { googleId: sub } });

  if (!user) {
    // 2) Find by email (existing OTP account with same verified email -> link)
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      // Link Google to existing account
      // Prevent linking if existing account already has different googleId (should not happen via findUnique googleId)
      user = await prisma.user.update({
        where: { id: byEmail.id },
        data: {
          googleId: sub,
          avatarUrl: avatarUrl || byEmail.avatarUrl,
          emailVerified: true,
          name: byEmail.name || name,
        },
      });
      await audit("SYSTEM", user.id, "LINK_GOOGLE", "User", user.id, { email });
    } else {
      // 3) Check duplicate phone? Not needed for Google
      // Create new user via Google
      user = await prisma.user.create({
        data: {
          email,
          name,
          googleId: sub,
          avatarUrl,
          emailVerified: true,
          role: "CUSTOMER",
        },
      });
      await audit("SYSTEM", user.id, "SIGNUP_GOOGLE", "User", user.id, { email });
    }
  } else {
    // Existing Google user -> update avatar/name if needed
    if ((name && user.name !== name) || (avatarUrl && user.avatarUrl !== avatarUrl)) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: user.name || name,
          avatarUrl: avatarUrl || user.avatarUrl,
        },
      });
    }
  }

  if (user.status !== "ACTIVE") return fail("This account is unavailable. Contact support for help.", 403);

  const token = createSessionToken({ userId: user.id, role: user.role, name: user.name || undefined });
  const res = ok({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone, avatarUrl: user.avatarUrl, role: user.role } });
  res.cookies.set(sessionCookieOptions().name, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: sessionCookieOptions().maxAge,
    path: "/",
  });
  return res;
}

// GET returns client config for frontend
export async function GET() {
  const clientId = getClientId();
  if (!clientId) return ok({ configured: false });
  return ok({ configured: true, clientId });
}
