import { NextRequest } from "next/server";
import { scryptSync, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { createSessionToken } from "@/lib/session";
import { audit } from "@/lib/services/auditService";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`admin-login:ip:${ip}`, 10, 60_000);
  if (!rl.allowed) return fail("Too many login attempts. Try again shortly.", 429);

  const b = await req.json().catch(() => ({}));
  const phone = String(b.phone || "").replace(/\D/g, "");
  const password = String(b.password || "");
  const user = await prisma.user.findFirst({ where: { phone, role: "ADMIN" } });
  if (!user?.passwordHash) return fail("Invalid admin credentials", 401);

  const [salt, hash] = user.passwordHash.split(":");
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected))
    return fail("Invalid admin credentials", 401);

  await audit("ADMIN", user.id, "LOGIN", "Session", null, {});
  const token = createSessionToken({ userId: user.id, role: "ADMIN", name: user.name || "Admin" });
  const res = ok({ admin: { name: user.name || "Admin" } });
  res.cookies.set("nw_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return res;
}
