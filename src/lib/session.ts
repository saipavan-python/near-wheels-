import { createHmac, timingSafeEqual, randomUUID } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "nw_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30;

export interface SessionPayload {
  userId: string;
  role: string; // CUSTOMER | PROVIDER | ADMIN
  name?: string;
  exp: number; // unix sec
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  const knownDefaults = new Set([
    "change-me-to-a-long-random-string",
    "change-me-to-a-long-random-string-at-least-32-chars",
  ]);
  if (!s || knownDefaults.has(s) || s.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set to a strong random value in production");
    }
    return "dev-only-secret-change-me-not-for-production-use-32chars-v2";
  }
  return s;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createSessionToken(payload: Omit<SessionPayload, "exp">): string {
  const full: SessionPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC };
  const body = b64url(JSON.stringify(full));
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !/^[A-Za-z0-9_-]{43}$/.test(sig)) return null;
  try {
    const expected = sign(body);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload: unknown = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!payload || typeof payload !== "object") return null;
    const session = payload as Partial<SessionPayload>;
    if (
      typeof session.userId !== "string" || !session.userId || session.userId.length > 128 ||
      !["CUSTOMER", "PROVIDER", "ADMIN"].includes(String(session.role)) ||
      !Number.isSafeInteger(session.exp) || (session.exp as number) * 1000 <= Date.now() ||
      (session.name !== undefined && typeof session.name !== "string")
    ) return null;
    return session as SessionPayload;
  } catch {
    return null;
  }
}

/** Read the current session inside route handlers / server components. */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    return verifySessionToken((await cookies()).get(COOKIE)?.value);
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    name: COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SEC,
    path: "/",
  };
}

export function newIdempotencyKey(): string {
  return randomUUID();
}
