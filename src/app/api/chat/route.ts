import { NextRequest } from "next/server";
import { handleChatMessage } from "@/lib/ai/orchestrator";
import { getSession } from "@/lib/session";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const message = String(body.message || "").slice(0, 2000);
    if (!message.trim()) return fail("Empty message");

    const session = await getSession();
    let customerId: string | null = null;
    let customerName: string | null = null;
    if (session?.role === "CUSTOMER" || session?.role === "ADMIN") {
      customerId = session.userId;
      const u = await prisma.user.findUnique({ where: { id: session.userId } });
      customerName = u?.name || null;
    }

    // stable anonymous device key so guests keep conversation context too
    const sessionKey =
      req.cookies.get("nw_device")?.value ||
      `anon-${randomUUID()}`;

    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const userLocation =
      Number.isFinite(lat) && Number.isFinite(lng)
        ? { lat, lng, label: String(body.locationLabel || "Current location") }
        : null;

    const result = await handleChatMessage({
      message,
      conversationId: body.conversationId ? String(body.conversationId) : undefined,
      sessionKey,
      customerId,
      customerName,
      pageContext: body.pageContext ? String(body.pageContext) : undefined,
      userLocation,
    });

    const res = ok({
      conversationId: result.conversationId,
      reply: result.reply,
      payload: result.payload,
      degraded: result.degraded ?? null,
    });
    if (!req.cookies.get("nw_device")) {
      res.cookies.set("nw_device", sessionKey, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
    }
    return res;
  } catch (e: any) {
    console.error("chat error:", e?.message || "unknown");
    return fail("The assistant hit an unexpected problem. Please try again.", 500);
  }
}

export const dynamic = "force-dynamic";