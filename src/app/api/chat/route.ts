import { NextRequest } from "next/server";
import { handleChatMessage } from "@/lib/ai/orchestrator";
import { getSession } from "@/lib/session";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const message = String(body.message || "").slice(0, 2000);
    if (!message.trim()) return fail("Empty message");

    const session = getSession();
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
      `anon-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

    const result = await handleChatMessage({
      message,
      conversationId: body.conversationId ? String(body.conversationId) : undefined,
      sessionKey,
      customerId,
      customerName,
      pageContext: body.pageContext ? String(body.pageContext) : undefined,
    });

    const res = ok({
      conversationId: result.conversationId,
      reply: result.reply,
      payload: result.payload,
      degraded: result.degraded ?? null,
    });
    if (!req.cookies.get("nw_device")) {
      res.cookies.set("nw_device", sessionKey, {
        httpOnly: false,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
    }
    return res;
  } catch (e: any) {
    console.error("chat error", e);
    return fail("The assistant hit an unexpected problem. Please try again.", 500);
  }
}
