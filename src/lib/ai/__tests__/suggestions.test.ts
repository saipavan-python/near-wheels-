import { describe, expect, it } from "vitest";
import { buildSuggestions } from "../suggestions";
import type { ChatContext, ChatPayload } from "../chatTypes";

const baseCtx: ChatContext = {};

describe("buildSuggestions (RedBus rYde-style follow-up chips)", () => {
  it("offers search follow-ups when result cards are present", () => {
    const s = buildSuggestions(baseCtx, { cards: [{ kind: "VEHICLE", id: "v1" } as any] });
    expect(s).toContain("Book option 1");
    expect(s).toContain("Compare the first two");
    expect(s).toContain("Cheapest option");
  });

  it("asks for the schedule first in the guided booking journey", () => {
    const ctx: ChatContext = {
      pendingBooking: { listingKind: "VEHICLE", listingId: "v1", providerName: "Rentals", title: "Ertiga", kind: "rental" },
    };
    const s = buildSuggestions(ctx, {});
    expect(s).toEqual(["Now", "Tomorrow", "Day after tomorrow"]);
  });

  it("asks for duration once a schedule is chosen", () => {
    const ctx: ChatContext = {
      pendingBooking: {
        listingKind: "VEHICLE",
        listingId: "v1",
        providerName: "Rentals",
        title: "Ertiga",
        kind: "rental",
        scheduledFor: new Date().toISOString(),
      },
    };
    const s = buildSuggestions(ctx, {});
    expect(s).toEqual(["4 hours", "1 day", "2 days", "Full week"]);
  });

  it("moves to confirmation once schedule + duration are known", () => {
    const ctx: ChatContext = {
      pendingBooking: {
        listingKind: "VEHICLE",
        listingId: "v1",
        providerName: "Rentals",
        title: "Ertiga",
        kind: "rental",
        scheduledFor: new Date().toISOString(),
        durationDays: 2,
      },
    };
    expect(buildSuggestions(ctx, {})).toContain("Confirm & book now");
  });

  it("surfaces location options when the backend asks to disambiguate", () => {
    const s = buildSuggestions(baseCtx, {
      locationOptions: [
        { id: "g1", label: "Guntur, CITY", lat: 1, lng: 2 },
        { id: "g2", label: "Guntur West, VILLAGE", lat: 3, lng: 4 },
      ],
    });
    expect(s).toEqual(["Guntur, CITY", "Guntur West, VILLAGE"]);
  });

  it("offers booking follow-ups after a booking payload", () => {
    const s = buildSuggestions(baseCtx, { booking: { code: "NW12345", status: "ACCEPTED" } });
    expect(s).toEqual(["Check my booking", "Cancel this booking", "Plan another trip"]);
  });

  it("offers budget alternatives when a trip plan is over budget", () => {
    const s = buildSuggestions(baseCtx, {
      tripPlan: {
        budgetComparison: { possible: false, budget: 5000, estimatedTotal: 8200, delta: -3200, confidence: "ESTIMATE", disclaimer: "x" },
        distance: { oneWayKm: 100, totalKm: 200, source: "OSRM" },
        cheapest: { title: "Ertiga", total: 8200, confidence: "ESTIMATE", lines: [] },
        options: [],
      },
    });
    expect(s).toContain("Try a bigger budget");
  });

  it("falls back to generic help chips (+ location chip before GPS is shared)", () => {
    const s = buildSuggestions(baseCtx, {} as ChatPayload);
    expect(s).toEqual(["Use my location", "Find a vehicle near me", "I need a driver", "Budget trip plan", "Check my booking"]);
  });

  it("does not suggest GPS again once the user shared it", () => {
    const s = buildSuggestions({ ...baseCtx, userLocation: { lat: 16.3, lng: 80.4, label: "Current location" } }, {} as ChatPayload);
    expect(s).toEqual(["Find a vehicle near me", "I need a driver", "Budget trip plan", "Check my booking"]);
  });
});