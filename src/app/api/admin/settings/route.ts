import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { getSettings, saveSettings, PlatformSettings } from "@/lib/config";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function GET() {
  if (!(await requireAdmin())) return fail("Admin only", 403);
  return ok({ settings: await getSettings() });
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return fail("Admin only", 403);
  const ip = getClientIp(req);
  const rl = checkRateLimit(`admin-settings:${ip}`, 10, 60_000);
  if (!rl.allowed) return fail("Too many settings changes. Try again.", 429);
  const b = (await req.json().catch(() => ({}))) as Partial<PlatformSettings>;
  const settings = await saveSettings(b);
  return ok({ settings });
}
