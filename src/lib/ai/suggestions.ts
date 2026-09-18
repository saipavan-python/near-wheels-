import type { ChatContext, ChatPayload } from "./chatTypes";

/**
 * Context-aware follow-up chips rendered under every bot reply
 * (RedBus rYde style). Purely client-hint text — the user taps a chip,
 * it is sent as a normal message and the LLM/tools interpret it.
 */
const GENERIC = [
  "Find a vehicle near me",
  "I need a driver",
  "Budget trip plan",
  "Check my booking",
];

function withLocationChip(ctx: ChatContext, chips: string[]): string[] {
  // only suggest GPS when the customer hasn't shared it yet
  return ctx.userLocation ? chips : ["Use my location", ...chips];
}

export function buildSuggestions(ctx: ChatContext, payload: ChatPayload): string[] {
  if (payload.needsLogin) return ["I've logged in — continue"];
  if (payload.needsPayment) return ["I've paid — verify my booking", "Check my booking"];
  if (payload.locationOptions && payload.locationOptions.length) {
    return payload.locationOptions.slice(0, 3).map((o) => o.label);
  }

  // Guided booking journey — one question at a time.
  if (ctx.pendingBooking) {
    if (!ctx.pendingBooking.scheduledFor) {
      return ["Now", "Tomorrow", "Day after tomorrow"];
    }
    if (!ctx.pendingBooking.durationDays && !ctx.pendingBooking.durationHours) {
      return ["4 hours", "1 day", "2 days", "Full week"];
    }
    return ["Confirm & book now"];
  }

  if (payload.cards && payload.cards.length > 0) {
    const chips = ["Cheapest option", "Compare the first two"];
    chips.push("Book option 1");
    return chips;
  }

  if (payload.tripPlan) {
    return payload.tripPlan.budgetComparison.possible
      ? ["Book the cheapest option", "Try a smaller budget", "Plan another trip"]
      : ["Try a bigger budget", "Show cheaper vehicles", "Plan another trip"];
  }

  if (payload.booking) return ["Check my booking", "Cancel this booking", "Plan another trip"];
  if (ctx.lastBookingCode) return ["Check my booking", "Plan another trip"];
  if (payload.noResults) return withLocationChip(ctx, ["Search another town", "Try different vehicle", "Budget trip plan"]);
  if (ctx.selected) return ["Book it now", "Tomorrow", "Day after tomorrow"];
  if (ctx.lastSearchKind && ctx.lastResults?.length) return ["Cheapest option", "Book option 1"];

  return withLocationChip(ctx, GENERIC);
}