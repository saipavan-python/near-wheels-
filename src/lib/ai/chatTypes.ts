import type { ResultCard, PriceQuote } from "../types";
import type { SearchFilters } from "../types";

/** Rich payload the chat UI renders alongside the bot's text reply. */
export interface ChatPayload {
  cards?: ResultCard[];
  table?: { title?: string; headers: string[]; rows: (string | number)[][] };
  locationOptions?: { id: string; label: string; lat: number; lng: number }[];
  booking?: Record<string, unknown> | null;
  quote?: PriceQuote;
  needsLogin?: boolean;
  needsPayment?: { bookingId: string; amount: number } | null;
  suggestions?: string[];
  noResults?: boolean;
  tripPlan?: {
    budgetComparison: { budget: number; estimatedTotal: number; delta: number; possible: boolean; confidence: string; disclaimer: string };
    distance: { oneWayKm: number; totalKm: number; source: string };
    cheapest: { title: string; total: number; confidence: string; lines: unknown };
    options: Array<{ title: string; total: number; confidence: string; lines: unknown }>;
  };
  tripCost?: Record<string, unknown>;
}

export interface ChatContext {
  lastResults?: ResultCard[];
  lastSearchKind?: "VEHICLES" | "DRIVERS" | "GARAGES" | "FARM" | "DRONES";
  lastSearchFilters?: SearchFilters;
  priority?: string;
  resolvedLocation?: string;
  selected?: { kind: ResultCard["kind"]; id: string; index: number };
  pendingBooking?: {
    listingKind: ResultCard["kind"];
    listingId: string;
    providerName: string;
    title: string;
    kind: string;
    scheduledFor?: string | null;
    durationDays?: number;
    durationHours?: number;
    acres?: number;
    estKm?: number;
    locationText?: string;
    destLat?: number;
    destLng?: number;
  } | null;
  lastBookingCode?: string;
  userLocation?: { lat: number; lng: number; label: string } | null;
}
