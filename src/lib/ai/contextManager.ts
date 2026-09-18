import { prisma } from "../db";
import { parse } from "../utils";
import type { Conversation, Message } from "@prisma/client";
import type { ChatContext } from "./chatTypes";

export async function getOrCreateConversation(opts: {
  conversationId?: string;
  sessionKey: string;
  customerId?: string | null;
  pageContext?: string;
}): Promise<Conversation> {
  if (opts.conversationId) {
    const found = await prisma.conversation.findUnique({ where: { id: opts.conversationId } });
    if (found) return found;
  }
  // continue most recent open conversation for this device+page
  const recent = await prisma.conversation.findFirst({
    where: { sessionKey: opts.sessionKey, status: "OPEN" },
    orderBy: { updatedAt: "desc" },
  });
  if (recent) return recent;
  return prisma.conversation.create({
    data: {
      sessionKey: opts.sessionKey,
      customerId: opts.customerId ?? undefined,
      pageContext: opts.pageContext || "home",
      title: null,
    },
  });
}

export function readContext(conversation: Conversation): ChatContext {
  return parse<ChatContext>(conversation.contextJson, {});
}

export async function saveContext(conversationId: string, ctx: ChatContext, patchTitle?: string) {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { contextJson: JSON.stringify(ctx), ...(patchTitle ? { title: patchTitle } : {}) },
  });
}

export async function appendMessage(
  conversationId: string,
  role: "user" | "assistant",
  text: string,
  payload?: unknown
): Promise<Message> {
  const last = await prisma.message.findFirst({
    where: { conversationId },
    orderBy: { idx: "desc" },
    take: 1,
  });
  return prisma.message.create({
    data: {
      conversationId,
      idx: (last?.idx ?? -1) + 1,
      role,
      text,
      payloadJson: payload ? JSON.stringify(payload) : undefined,
    },
  });
}

export async function loadRecentMessages(conversationId: string, limit = 12): Promise<Message[]> {
  const msgs = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { idx: "desc" },
    take: limit,
  });
  return msgs.reverse();
}

export function contextSummaryForChat(ctx: ChatContext): string {
  const parts: string[] = [];
  if (ctx.priority) parts.push(`customer priority: ${ctx.priority}`);
  if (ctx.resolvedLocation) parts.push(`resolved location: ${ctx.resolvedLocation}`);
  if (ctx.lastResults?.length) {
    parts.push(
      `current results (${ctx.lastResults.length}): ` +
        ctx.lastResults
          .slice(0, 6)
          .map((c, i) => `${i + 1}. ${c.title} [${c.kind}] ₹${c.priceFrom ?? "?"} ${c.distanceKm ?? "?"}km`)
          .join("; ")
    );
  }
  if (ctx.pendingBooking) {
    parts.push(`pending booking draft: ${JSON.stringify(ctx.pendingBooking)}`);
  }
  if (ctx.lastBookingCode) parts.push(`latest booking code: ${ctx.lastBookingCode}`);
  if (ctx.userLocation) parts.push(`user current location (GPS): ${ctx.userLocation.label} (${ctx.userLocation.lat}, ${ctx.userLocation.lng})`);
  return parts.length ? parts.join(" | ") : "empty — no search yet";
}
