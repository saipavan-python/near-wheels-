import { prisma } from "../db";
import type { AnalyticsEvent } from "@prisma/client";

/** Fire-and-forget product + AI-quality analytics (spec §88–90). */
export async function track(
  kind: string,
  props: Record<string, unknown> = {},
  ids: { customerId?: string | null; conversationId?: string | null } = {}
): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        kind,
        props: JSON.stringify(props),
        customerId: ids.customerId ?? undefined,
        conversationId: ids.conversationId ?? undefined,
      },
    });
  } catch {
    // analytics must never break the request path
  }
}

function countBy(rows: AnalyticsEvent[], key: (e: AnalyticsEvent) => string) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return Object.fromEntries(m);
}

export interface AiQualityMetrics {
  searchesTotal: number;
  noResultRate: number;
  clarificationRate: number;
  correctionRate: number;
  bookingConversion: number;
  topIntents: Record<string, number>;
}

export async function aiQualityMetrics(): Promise<AiQualityMetrics> {
  const since = new Date(Date.now() - 30 * 24 * 3600_000);
  const [events, conversations, bookings] = await Promise.all([
    prisma.analyticsEvent.findMany({ where: { createdAt: { gte: since }, kind: { startsWith: "ai_" } } }),
    prisma.conversation.count({ where: { createdAt: { gte: since } } }),
    prisma.booking.count({ where: { createdAt: { gte: since } } }),
  ]);
  const kinds = countBy(events, (e) => e.kind);
  const intents = countBy(
    events.filter((e) => e.kind === "ai_intent"),
    (e) => JSON.parse(e.props).intent || "unknown"
  );
  const searches = kinds["ai_search"] || 0;
  return {
    searchesTotal: searches,
    noResultRate: searches ? (kinds["ai_no_result"] || 0) / searches : 0,
    clarificationRate: conversations ? (kinds["ai_clarification"] || 0) / Math.max(1, conversations) : 0,
    correctionRate: conversations ? (kinds["ai_correction"] || 0) / Math.max(1, conversations) : 0,
    bookingConversion: conversations ? bookings / conversations : 0,
    topIntents: intents,
  };
}
