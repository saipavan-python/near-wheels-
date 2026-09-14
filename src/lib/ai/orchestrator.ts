import { prisma } from "../db";
import { runWithTools, Content } from "./gemini";
import { TOOLS } from "./tools";
import { buildSystemPrompt } from "./systemPrompt";
import {
  getOrCreateConversation,
  readContext,
  saveContext,
  appendMessage,
  loadRecentMessages,
  contextSummaryForChat,
} from "./contextManager";
import type { ChatContext, ChatPayload } from "./chatTypes";
import {
  searchVehicles,
  searchDrivers,
  searchGarages,
  searchFarm,
  searchDrones,
  AmbiguousLocationError,
  NoLocationError,
} from "../services/searchService";
import { quoteFromRule, findRuleForTarget } from "../services/pricingService";
import { createBooking, getPublicBooking, cancelBooking, modifyBookingSchedule, bookingsForCustomer, BookingConflictError } from "../services/bookingService";
import { isAvailableNow } from "../services/availabilityService";
import { track } from "../services/analyticsService";
import type { ResultCard, SearchFilters, SortPriority, PriceQuote } from "../types";

export interface OrchestratorInput {
  message: string;
  conversationId?: string;
  sessionKey: string;
  customerId?: string | null;
  customerName?: string | null;
  pageContext?: string;
}

const rateBucket = new Map<string, number[]>();
function allow(sessionKey: string): boolean {
  const now = Date.now();
  const arr = (rateBucket.get(sessionKey) || []).filter((t) => now - t < 60_000);
  if (arr.length >= 20) return false;
  arr.push(now);
  rateBucket.set(sessionKey, arr);
  return true;
}

function filtersFromArgs(args: any, base: SearchFilters = {}): SearchFilters {
  const f: SearchFilters = { ...base };
  if (args.location_text) f.locationText = args.location_text;
  if (args.category) f.category = args.category;
  if (args.model) f.model = args.model;
  if (args.rental_mode) f.rentalMode = args.rental_mode === "SELF_DRIVE" ? "SELF_DRIVE" : "WITH_DRIVER";
  if (typeof args.seats === "number") f.seats = args.seats;
  if (typeof args.ac === "boolean") f.ac = args.ac;
  else if (args.ac === "true") f.ac = true;
  else if (args.ac === "false") f.ac = false;
  if (typeof args.load_tons === "number") f.loadTons = args.load_tons;
  if (args.scheduled_for_iso) f.scheduledFor = args.scheduled_for_iso;
  if (typeof args.duration_days === "number" && args.duration_days > 0) f.durationDays = Math.round(args.duration_days);
  if (args.sort_by) f.sortBy = normSort(args.sort_by);
  if (!f.ac) f.ac = null; // unknown stays unknown (spec §6)
  return f;
}

function normSort(s: string): SortPriority {
  const v = s.toUpperCase();
  if (v.includes("NEAR")) return "NEAREST";
  if (v.includes("CHEAP")) return "CHEAPEST";
  if (v.includes("RATE")) return "BEST_RATED";
  if (v.includes("FAST")) return "FASTEST";
  return "BEST_MATCH";
}

async function runSearch(kind: ChatContext["lastSearchKind"], f: SearchFilters) {
  switch (kind) {
    case "VEHICLES":
      return searchVehicles(f);
    case "DRIVERS":
      return searchDrivers(f);
    case "GARAGES":
      return searchGarages({ ...f, serviceTypes: f.serviceTypes });
    case "FARM":
      return searchFarm(f);
    case "DRONES":
      return searchDrones(f);
    default:
      return searchVehicles(f);
  }
}

/** Execute one tool against REAL backend services. No shortcuts. */
async function executeTool(
  name: string,
  rawArgs: Record<string, unknown>,
  ctx: { customerId?: string | null; context: ChatContext; conversationId: string }
): Promise<{ result: unknown; payloadPatch: Partial<ChatPayload>; contextPatch: Partial<ChatContext> }> {
  const args = rawArgs as any;

  try {
    switch (name) {
      case "resolve_location": {
        const { resolveLocation } = await import("../services/locationService");
        const r = await resolveLocation(args.query);
        if (r.resolved)
          return {
            result: {
              resolved: true,
              name: r.resolved.name,
              lat: r.resolved.lat,
              lng: r.resolved.lng,
              confidence: r.confidence,
            },
            payloadPatch: {},
            contextPatch: { resolvedLocation: r.resolved.name },
          };
        return {
          result: {
            resolved: false,
            ambiguous: r.ambiguous || r.candidates.length > 0,
            options: r.candidates.map((c) => ({ name: c.name, label: [c.name, c.type, c.district].filter(Boolean).join(", ") })),
          },
          payloadPatch: {
            locationOptions: r.candidates.map((c) => ({
              id: c.id,
              label: [c.name, c.type, c.district].filter(Boolean).join(", "),
              lat: c.lat,
              lng: c.lng,
            })),
          },
          contextPatch: {},
        };
      }

      case "search_vehicles":
      case "search_drivers":
      case "search_garages":
      case "search_farm_equipment":
      case "search_drone_operators": {
        const kindMap: Record<string, NonNullable<ChatContext["lastSearchKind"]>> = {
          search_vehicles: "VEHICLES",
          search_drivers: "DRIVERS",
          search_garages: "GARAGES",
          search_farm_equipment: "FARM",
          search_drone_operators: "DRONES",
        };
        const kind = kindMap[name];
        let f = filtersFromArgs(args);
        if (name === "search_garages" && Array.isArray(args.service_types)) f.serviceTypes = args.service_types;
        if (name === "search_farm_equipment" && typeof args.acres === "number") f.acres = args.acres;
        if ((name === "search_drone_operators" || name === "search_farm_equipment") && typeof args.acres === "number")
          f.acres = args.acres;

        // carry over previous location when the new utterance omits it
        if (!f.locationText && ctx.context.lastSearchFilters?.locationText && !ctx.context.lastSearchFilters?.lat)
          f.locationText = ctx.context.lastSearchFilters.locationText;

        const res = await runSearch(kind, f);
        await track("ai_search", { kind, results: res.items.length }, { conversationId: ctx.conversationId });
        if (res.items.length === 0)
          await track("ai_no_result", { kind, query: f.locationText || "" }, { conversationId: ctx.conversationId });

        const patch: Partial<ChatPayload> = { cards: res.items };
        return {
          result: {
            found: res.items.length,
            showingAlternatives: res.showingAlternatives,
            searchedRadiusKm: res.searchedRadiusKm,
            results: res.items.map((c, i) => ({
              index: i + 1,
              title: c.title,
              subtitle: c.subtitle,
              distance_km: c.distanceKm,
              eta_min: c.etaMin,
              available_now: c.availableNow,
              price: c.priceLabel,
              rating: c.rating,
              verified: c.verified,
              why: c.reason || undefined,
            })),
          },
          payloadPatch: patch,
          contextPatch: {
            lastResults: res.items,
            lastSearchKind: kind,
            lastSearchFilters: f,
            priority: f.sortBy || ctx.context.priority,
            selected: undefined,
          },
        };
      }

      case "get_result_details": {
        const idx = Number(args.index) - 1;
        const card = ctx.context.lastResults?.[idx];
        if (!card) return { result: { error: `No result at position ${args.index}` }, payloadPatch: {}, contextPatch: {} };
        return {
          result: { index: idx + 1, ...card },
          payloadPatch: { cards: [card] },
          contextPatch: { selected: { kind: card.kind, id: card.id, index: idx + 1 } },
        };
      }

      case "compare_results": {
        const idxs = (args.indexes as number[]).map(Number);
        const cards = idxs.map((i) => ctx.context.lastResults?.[i - 1]).filter(Boolean) as ResultCard[];
        if (cards.length < 2)
          return { result: { error: "Need at least two valid results to compare" }, payloadPatch: {}, contextPatch: {} };
        const headers = ["", ...cards.map((c, i) => `${idxs[i]}. ${c.title}`)];
        const rows: (string | number)[][] = [
          ["Distance", ...cards.map((c) => (c.distanceKm != null ? `${c.distanceKm} km` : "—"))],
          ["ETA", ...cards.map((c) => (c.etaMin != null ? `${c.etaMin} min` : "—"))],
          ["Price", ...cards.map((c) => c.priceLabel)],
          ["Rating", ...cards.map((c) => c.rating || "—")],
          ["Available now", ...cards.map((c) => (c.availableNow ? "Yes" : "No"))],
          ["Verified", ...cards.map((c) => (c.verified ? "Yes" : "No"))],
        ];
        return { result: { comparison: rows }, payloadPatch: { table: { title: "Comparison", headers, rows } }, contextPatch: {} };
      }

      case "re_rank_results": {
        const prevKind = ctx.context.lastSearchKind || "VEHICLES";
        const prevFilters = ctx.context.lastSearchFilters || {};
        const f = filtersFromArgs(args, { ...prevFilters, ac: undefined });
        if (typeof args.ac === "boolean") f.ac = args.ac;
        if (!args.location_text) delete f.locationText;
        const res = await runSearch(prevKind, f);
        return {
          result: {
            found: res.items.length,
            results: res.items.slice(0, 8).map((c, i) => ({
              index: i + 1,
              title: c.title,
              price: c.priceLabel,
              distance_km: c.distanceKm,
              eta_min: c.etaMin,
              available_now: c.availableNow,
              rating: c.rating,
            })),
          },
          payloadPatch: { cards: res.items },
          contextPatch: {
            lastResults: res.items,
            lastSearchFilters: f,
            priority: f.sortBy || ctx.context.priority,
          },
        };
      }

      case "quote_price": {
        const idx = Number(args.index) - 1;
        const card = ctx.context.lastResults?.[idx];
        if (!card) return { result: { error: `No result at position ${args.index}` }, payloadPatch: {}, contextPatch: {} };
        const rule = await findRuleForTarget(card.providerId, ruleTarget(card.kind), card.id);
        const quote = quoteFromRule(rule, {
          days: args.days,
          hours: args.hours,
          km: args.km,
          acres: args.acres,
        });
        return {
          result: quote,
          payloadPatch: { quote },
          contextPatch: {
            pendingBooking: upsertDraft(ctx.context, card, { durationDays: args.days, durationHours: args.hours, acres: args.acres, estKm: args.km }),
          },
        };
      }

      case "create_booking": {
        if (!ctx.customerId)
          return {
            result: { needsLogin: true, message: "Booking requires the customer to be logged in." },
            payloadPatch: { needsLogin: true },
            contextPatch: {},
          };
        const idx = Number(args.index ?? ctx.context.selected?.index) - 1;
        const card = ctx.context.lastResults?.[idx];
        if (!card) return { result: { error: `No result at position ${args.index}` }, payloadPatch: {}, contextPatch: {} };

        const draft = upsertDraft(ctx.context, card, {
          durationDays: args.duration_days,
          durationHours: args.duration_hours,
          acres: args.acres,
          estKm: args.est_km,
          scheduledFor: args.scheduled_for_iso || null,
        });
        const idem = `chat-${ctx.conversationId}-${card.kind}-${card.id}-${draft.scheduledFor || "now"}-${
          draft.durationDays || ""
        }-${draft.durationHours || ""}-${draft.acres || ""}`;

        const { booking } = await createBooking({
          customerId: ctx.customerId,
          kind: bookingKindFor(card),
          listingKind: card.kind,
          listingId: card.id,
          scheduledFor: draft.scheduledFor || null,
          durationDays: draft.durationDays,
          durationHours: draft.durationHours,
          acres: draft.acres,
          estKm: draft.estKm,
          locationText: draft.locationText,
          destLat: draft.destLat,
          destLng: draft.destLng,
          notes: args.note || "",
          idempotencyKey: idem,
        });

        const pb = await getPublicBooking(booking.id);
        const confirmed = booking.status === "CONFIRMED";
        const accepted = ["ACCEPTED", "CONFIRMED"].includes(booking.status);

        return {
          result: {
            created: true,
            booking_code: booking.code,
            status: booking.status,
            payment_status: booking.paymentStatus,
            total_amount: booking.totalAmount,
            provider: booking.providerName,
            when: booking.scheduledFor,
            note_to_customer:
              booking.status === "PENDING_PROVIDER"
                ? "Request sent to provider — confirmation will follow once they accept."
                : accepted
                ? "Provider accepted. Payment can proceed; booking becomes CONFIRMED only after verified payment."
                : "",
          },
          payloadPatch: {
            booking: pb,
            needsPayment:
              booking.paymentStatus === "UNPAID" && ["ACCEPTED", "PENDING_PROVIDER"].includes(booking.status)
                ? { bookingId: booking.id, amount: booking.totalAmount }
                : null,
          },
          contextPatch: { pendingBooking: null, lastBookingCode: booking.code },
        };
      }

      case "get_booking_status": {
        if (!ctx.customerId) return { result: { needsLogin: true }, payloadPatch: { needsLogin: true }, contextPatch: {} };
        let b = args.code ? await getPublicBooking(String(args.code)) : null;
        if (!b && ctx.customerId) {
          const mine = await bookingsForCustomer(ctx.customerId);
          b = (mine[0] as any) || null;
        }
        if (!b) return { result: { found: false }, payloadPatch: {}, contextPatch: {} };
        return { result: { found: true, ...b }, payloadPatch: { booking: b as any }, contextPatch: { lastBookingCode: (b as any).code } };
      }

      case "cancel_booking": {
        if (!ctx.customerId) return { result: { needsLogin: true }, payloadPatch: { needsLogin: true }, contextPatch: {} };
        const code = args.code || ctx.context.lastBookingCode;
        if (!code) return { result: { error: "Which booking should I cancel?" }, payloadPatch: {}, contextPatch: {} };
        const b = await getPublicBooking(String(code));
        if (!b) return { result: { found: false }, payloadPatch: {}, contextPatch: {} };
        if (b.customerId !== ctx.customerId) return { result: { error: "That booking belongs to a different account" }, payloadPatch: {}, contextPatch: {} };
        const updated = await cancelBooking(b.id, "CUSTOMER", args.reason || "Cancelled via assistant");
        return {
          result: { cancelled: true, code: updated.code },
          payloadPatch: { booking: publicize(updated) },
          contextPatch: {},
        };
      }

      case "modify_booking": {
        if (!ctx.customerId) return { result: { needsLogin: true }, payloadPatch: { needsLogin: true }, contextPatch: {} };
        const code = args.code || ctx.context.lastBookingCode;
        const b = code ? await getPublicBooking(String(code)) : null;
        if (!b) return { result: { error: "I couldn't find that booking." }, payloadPatch: {}, contextPatch: {} };
        if (b.customerId !== ctx.customerId) return { result: { error: "That booking belongs to a different account" }, payloadPatch: {}, contextPatch: {} };
        const updated = await modifyBookingSchedule(b.id, {
          scheduledFor: args.scheduled_for_iso ? new Date(args.scheduled_for_iso) : undefined,
          durationDays: args.duration_days,
          durationHours: args.duration_hours,
        });
        return {
          result: { modified: true, code: updated.code, new_when: updated.scheduledFor, new_total: updated.totalAmount },
          payloadPatch: { booking: publicize(updated) },
          contextPatch: {},
        };
      }

      case "book_again": {
        if (!ctx.customerId)
          return { result: { needsLogin: true }, payloadPatch: { needsLogin: true }, contextPatch: {} };
        const history = await bookingsForCustomer(ctx.customerId);
        const wantFavorite = !!args.favorite;
        const nameQ = String(args.provider_name || "").toLowerCase();
        let match = history.find((h: any) => nameQ && h.providerName.toLowerCase().includes(nameQ));
        if (!match && wantFavorite) {
          const favs = await prisma.favorite.findMany({
            where: { customerId: ctx.customerId },
            include: { provider: true },
          });
          const favProvIds = favs.map((f) => f.providerId);
          match = (history as any[]).find((h) => favProvIds.includes(h.providerId));
        }
        if (!match) match = (history as any)[0];
        if (!match) return { result: { found: false, message: "No previous bookings yet." }, payloadPatch: {}, contextPatch: {} };
        const avail = await checkAvailability(match.listingKind, match.listingId);
        return {
          result: {
            found: true,
            provider: match.providerName,
            listing: match.listingTitle,
            last_booked_on: match.createdAt,
            currently_available: avail.ok,
            detail: avail.message,
            how_to_book: "Confirm with the customer, then search fresh results and book.",
          },
          payloadPatch: {},
          contextPatch: {},
        };
      }

      case "plan_trip_with_budget": {
        const budget = Number(args.budget);
        const from = String(args.from || "").trim();
        const to = String(args.to || "").trim();
        if (!budget || !from || !to) {
          return { result: { error: "Need budget, from, and to for trip planning" }, payloadPatch: {}, contextPatch: {} };
        }
        // Call deterministic budget engine via direct import (no fetch round-trip)
        const { calculateTripCost, compareBudget } = await import("../services/tripCostService");
        const { resolveLocation } = await import("../services/locationService");
        const { getRoute } = await import("../services/routingService");
        const { roadDistanceKm } = await import("../geo");

        // Resolve locations
        const rFrom = await resolveLocation(from);
        const rTo = await resolveLocation(to);
        if (!rFrom.resolved) {
          return {
            result: { need_location: true, field: "from", message: `Could not find "${from}"`, options: rFrom.candidates.map((c) => c.name) },
            payloadPatch: rFrom.candidates.length ? { locationOptions: rFrom.candidates.map((c) => ({ id: c.id, label: c.name, lat: c.lat, lng: c.lng })) } : {},
            contextPatch: {},
          };
        }
        if (!rTo.resolved) {
          return {
            result: { need_location: true, field: "to", message: `Could not find "${to}"`, options: rTo.candidates.map((c) => c.name) },
            payloadPatch: rTo.candidates.length ? { locationOptions: rTo.candidates.map((c) => ({ id: c.id, label: c.name, lat: c.lat, lng: c.lng })) } : {},
            contextPatch: {},
          };
        }
        const route = await getRoute({ fromLat: rFrom.resolved.lat, fromLng: rFrom.resolved.lng, toLat: rTo.resolved.lat, toLng: rTo.resolved.lng, roundTrip: !!args.round_trip || Number(args.days) >= 2 });
        const pax = typeof args.pax === "number" ? args.pax : undefined;
        const days = typeof args.days === "number" && args.days > 0 ? Math.round(args.days) : 1;
        const category = args.vehicle_category ? String(args.vehicle_category).toUpperCase() : undefined;
        const model = args.vehicle_model ? String(args.vehicle_model) : undefined;
        const withDriver = !!args.with_driver;

        // Find real vehicle candidates near origin
        const allVehicles = await prisma.vehicle.findMany({ where: { status: "ACTIVE" }, include: { provider: true } });
        const candidates = allVehicles
          .filter((v) => {
            if (v.provider.status !== "ACTIVE") return false;
            if (category && v.category !== category && !(category === "CAR" && v.category === "SUV")) return false;
            if (model && !`${v.make} ${v.model}`.toLowerCase().includes(model.toLowerCase())) return false;
            if (pax && v.seats < pax) return false;
            const d = roadDistanceKm(rFrom.resolved!.lat, rFrom.resolved!.lng, v.provider.lat, v.provider.lng);
            return d <= 60;
          })
          .map((v) => ({ v, d: roadDistanceKm(rFrom.resolved!.lat, rFrom.resolved!.lng, v.provider.lat, v.provider.lng) }))
          .sort((a, b) => a.d - b.d)
          .slice(0, 3);

        const optionCosts: Array<{ title: string; id: string; providerId: string; category: string; fuelType: string | null; total: number; lines: unknown; confidence: string; distanceOk: boolean }> = [];
        for (const { v } of candidates) {
          const tc = await calculateTripCost({
            vehicleId: v.id,
            vehicleProviderId: v.providerId,
            vehicleCategory: v.category,
            vehicleFuelType: v.fuelType,
            withDriver,
            fromLat: rFrom.resolved.lat,
            fromLng: rFrom.resolved.lng,
            toLat: rTo.resolved.lat,
            toLng: rTo.resolved.lng,
            roundTrip: !!args.round_trip || days >= 2,
            distanceKmOverride: route.totalKm,
            durationDays: days,
          });
          optionCosts.push({ title: v.title, id: v.id, providerId: v.providerId, category: v.category, fuelType: v.fuelType, total: tc.total, lines: tc.lines, confidence: tc.confidence, distanceOk: true });
        }

        if (optionCosts.length === 0) {
          // No vehicle matched filters — still compute transport cost baseline
          const baseline = await calculateTripCost({
            vehicleId: undefined,
            vehicleProviderId: "",
            vehicleCategory: category ?? null,
            vehicleFuelType: null,
            withDriver,
            fromLat: rFrom.resolved.lat,
            fromLng: rFrom.resolved.lng,
            toLat: rTo.resolved.lat,
            toLng: rTo.resolved.lng,
            roundTrip: !!args.round_trip || days >= 2,
            distanceKmOverride: route.totalKm,
            durationDays: days,
          });
          optionCosts.push({ title: "Select a vehicle to confirm price", id: "", providerId: "", category: category || "VEHICLE", fuelType: null, total: baseline.total, lines: baseline.lines, confidence: baseline.confidence, distanceOk: false });
        }

        const cheapest = [...optionCosts].sort((a, b) => a.total - b.total)[0];
        const budgetComparison = compareBudget(budget, cheapest.total, cheapest.confidence as "ESTIMATE" | "FINAL");

        // Fetch ResultCards for cheapest/best for UI
        const { searchVehicles } = await import("../services/searchService");
        let cards: ResultCard[] = [];
        try {
          const sr = await searchVehicles({
            locationText: rFrom.resolved.name,
            category: category,
            model: model,
            seats: pax,
            rentalMode: withDriver ? "WITH_DRIVER" : undefined,
          });
          cards = sr.items.slice(0, 3);
        } catch {
          // ignore
        }

        const tripPayload = {
          budgetComparison,
          distance: { oneWayKm: route.oneWayKm, totalKm: route.totalKm, source: route.source },
          cheapest: { title: cheapest.title, total: cheapest.total, confidence: cheapest.confidence, lines: cheapest.lines },
          options: optionCosts.map((o) => ({ title: o.title, total: o.total, confidence: o.confidence, lines: o.lines })),
        };

        return {
          result: {
            budgetComparison,
            distance: tripPayload.distance,
            cheapest: tripPayload.cheapest,
            options: tripPayload.options,
            cards_available: cards.length,
            message: budgetComparison.possible
              ? `Possible within ₹${budget.toLocaleString("en-IN")}: cheapest option ${cheapest.title} estimated ₹${cheapest.total.toLocaleString("en-IN")}, remaining ₹${budgetComparison.delta.toLocaleString("en-IN")}`
              : `May not fit: cheapest ₹${cheapest.total.toLocaleString("en-IN")} exceeds ₹${budget.toLocaleString("en-IN")} by ₹${Math.abs(budgetComparison.delta).toLocaleString("en-IN")}`,
          },
          payloadPatch: {
            cards: cards.length ? cards : undefined,
            tripPlan: tripPayload,
          } as unknown as Partial<ChatPayload>,
          contextPatch: { lastSearchKind: "VEHICLES" as const },
        };
      }

      case "calculate_trip_cost": {
        const idx = Number(args.vehicle_index) - 1;
        const card = ctx.context.lastResults?.[idx];
        if (!card) return { result: { error: `No result at position ${args.vehicle_index}` }, payloadPatch: {}, contextPatch: {} };
        // Need from/to: try context lastSearch location + args.from/to
        const fromLabel = (args.from as string) || ctx.context.lastSearchFilters?.locationText || "";
        const toLabel = (args.to as string) || "";
        const { resolveLocation } = await import("../services/locationService");
        const { getRoute } = await import("../services/routingService");
        const { calculateTripCost } = await import("../services/tripCostService");
        let fromLat = ctx.context.lastSearchFilters?.lat ?? null;
        let fromLng = ctx.context.lastSearchFilters?.lng ?? null;
        let toLat: number | null = null;
        let toLng: number | null = null;
        let distanceKm: number | null = null;
        if (fromLabel && fromLat == null) {
          const r = await resolveLocation(String(fromLabel));
          if (r.resolved) { fromLat = r.resolved.lat; fromLng = r.resolved.lng; }
        }
        if (toLabel) {
          const r = await resolveLocation(String(toLabel));
          if (r.resolved) { toLat = r.resolved.lat; toLng = r.resolved.lng; }
        }
        if (fromLat != null && toLat != null) {
          const route = await getRoute({ fromLat, fromLng: fromLng!, toLat, toLng: toLng!, roundTrip: !!args.round_trip });
          distanceKm = route.totalKm;
        }
        const days = typeof args.days === "number" && args.days > 0 ? Math.round(args.days) : 1;
        const withDriver = !!args.with_driver;
        // Extract vehicle fuelType/category from card meta
        const tc = await calculateTripCost({
          vehicleId: card.id,
          vehicleProviderId: card.providerId,
          vehicleCategory: String(card.category),
          vehicleFuelType: (card.meta.fuelType as string) || null,
          withDriver,
          fromLat: fromLat ?? card.distanceKm != null ? 0 : 0, // dummy if unknown — will use distanceKmOverride
          fromLng: fromLng ?? 0,
          toLat: toLat ?? 0,
          toLng: toLng ?? 0,
          roundTrip: !!args.round_trip,
          distanceKmOverride: distanceKm,
          durationDays: days,
        });
        return {
          result: tc,
          payloadPatch: {
            tripCost: tc as unknown as Record<string, unknown>,
            quote: { currency: "INR", lines: tc.lines, total: tc.total, confidence: tc.confidence, disclaimer: tc.disclaimer },
          } as unknown as Partial<ChatPayload>,
          contextPatch: {},
        };
      }

      case "escalate_support": {
        await track("support_escalation", { issue: String(args.issue || "").slice(0, 300) }, { conversationId: ctx.conversationId });
        return {
          result: { logged: true, message: "Support ticket noted. The team follows up within one working day." },
          payloadPatch: {},
          contextPatch: {},
        };
      }

      default:
        return { result: { error: `Unknown tool ${name}` }, payloadPatch: {}, contextPatch: {} };
    }
  } catch (e: any) {
    if (e instanceof AmbiguousLocationError) {
      return {
        result: { ambiguous: true, options: e.candidates.map((c) => c.label), instruction: "Ask which place they mean; offer current location option." },
        payloadPatch: { locationOptions: e.candidates },
        contextPatch: {},
      };
    }
    if (e instanceof NoLocationError) {
      return { result: { need_location: true, message: e.message }, payloadPatch: {}, contextPatch: {} };
    }
    if (e instanceof BookingConflictError) {
      return {
        result: { justBooked: true, message: "Someone booked this moments ago. Offer to search alternatives." },
        payloadPatch: {},
        contextPatch: {},
      };
    }
    return { result: { error: e?.message || "tool failed" }, payloadPatch: {}, contextPatch: {} };
  }
}

async function checkAvailability(listingKind: string, listingId: string) {
  try {
    const { resolveListing } = await import("../services/listingResolver");
    const l = await resolveListing({ listingKind, listingId });
    return { ok: l.availableNow, message: l.availableNow ? "available now" : "not available right now" };
  } catch {
    return { ok: false, message: "listing no longer active" };
  }
}

function ruleTarget(kind: ResultCard["kind"]): string {
  return kind === "VEHICLE"
    ? "VEHICLE"
    : kind === "DRIVER"
    ? "DRIVER"
    : kind === "GARAGE"
    ? "GARAGE_SERVICE"
    : kind === "FARM"
    ? "FARM_EQUIPMENT"
    : "DRONE_SERVICE";
}

function bookingKindFor(card: ResultCard): string {
  switch (card.kind) {
    case "VEHICLE":
      return card.meta.selfDrive ? "VEHICLE_SELF_DRIVE" : "VEHICLE_WITH_DRIVER";
    case "DRIVER":
      return "DRIVER";
    case "GARAGE":
      return "GARAGE";
    case "FARM":
      return "FARM_EQUIPMENT";
    default:
      return "DRONE_SPRAYING";
  }
}

function upsertDraft(
  ctx: ChatContext,
  card: ResultCard,
  patch: Record<string, unknown>
): NonNullable<ChatContext["pendingBooking"]> {
  const base = ctx.pendingBooking || {
    listingKind: card.kind,
    listingId: card.id,
    providerName: "",
    title: card.title,
    kind: bookingKindFor(card),
    locationText: ctx.lastSearchFilters?.locationText,
    destLat: ctx.lastSearchFilters?.lat,
    destLng: ctx.lastSearchFilters?.lng,
  };
  return { ...base, ...patch } as NonNullable<ChatContext["pendingBooking"]>;
}

function publicize(b: any) {
  const { priceBreakdownJson, ...rest } = b;
  void priceBreakdownJson;
  return rest;
}

export async function handleChatMessage(
  input: OrchestratorInput
): Promise<{ conversationId: string; reply: string; payload: ChatPayload; degraded?: string }> {
  const emptyPayload: ChatPayload = {};

  if (!allow(input.sessionKey)) {
    return {
      conversationId: input.conversationId || "",
      reply: "You're sending messages very fast. Please wait a moment and try again.",
      payload: emptyPayload,
    };
  }

  const conversation = await getOrCreateConversation({
    conversationId: input.conversationId,
    sessionKey: input.sessionKey,
    customerId: input.customerId ?? null,
    pageContext: input.pageContext,
  });
  const ctx = readContext(conversation);
  await appendMessage(conversation.id, "user", input.message);
  await track("ai_intent", { page: input.pageContext, text: input.message.slice(0, 120) }, { conversationId: conversation.id });

  if (!process.env.GEMINI_API_KEY) {
    // Fallback: work without Gemini using deterministic services (budget -> trip planner, otherwise search)
    try {
      const { parseTripIntent } = await import("../services/budgetParser");
      const intent = parseTripIntent(input.message);
      // If budget + from/to present, do budget trip plan directly
      if (intent.budget && intent.from && intent.to) {
        const out = await executeTool("plan_trip_with_budget", {
          budget: intent.budget,
          from: intent.from,
          to: intent.to,
          pax: intent.pax,
          days: intent.days,
          vehicle_category: intent.vehicleCategory,
          vehicle_model: intent.vehicleModel,
          with_driver: intent.withDriver,
          round_trip: intent.roundTrip,
        } as Record<string, unknown>, { customerId: input.customerId, context: ctx, conversationId: conversation.id });
        const payload: ChatPayload = { ...(out.payloadPatch as ChatPayload) };
        const result = out.result as { budgetComparison?: { possible: boolean; estimatedTotal: number; budget: number; delta: number }; cheapest?: { title: string; total: number } };
        let reply = "";
        if (result.budgetComparison) {
          if (result.budgetComparison.possible) {
            reply = `Yes, this trip looks possible within your ₹${result.budgetComparison.budget.toLocaleString("en-IN")} budget. Estimated total: ₹${result.budgetComparison.estimatedTotal.toLocaleString("en-IN")} (cheapest: ${result.cheapest?.title || "vehicle"}). Remaining: ₹${result.budgetComparison.delta.toLocaleString("en-IN")}. Fuel/toll are estimates.`;
          } else {
            reply = `This trip may not fit your ₹${result.budgetComparison.budget.toLocaleString("en-IN")} budget. Estimated total is ₹${result.budgetComparison.estimatedTotal.toLocaleString("en-IN")}. Additional ~₹${Math.abs(result.budgetComparison.delta).toLocaleString("en-IN")} needed.`;
          }
        } else {
          reply = "I checked your trip with our cost engine — see the breakdown below.";
        }
        // save context
        const newCtx = { ...ctx, ...(out.contextPatch as Partial<ChatContext>) };
        await saveContext(conversation.id, newCtx as ChatContext, conversation.title ?? input.message.slice(0, 40));
        await appendMessage(conversation.id, "assistant", reply, payload);
        return { conversationId: conversation.id, reply, payload, degraded: "no_api_key_fallback" };
      }
      // Fallback: try a simple search near the mentioned location
      const lower = input.message.toLowerCase();
      const isDriver = lower.includes("driver");
      const isGarage = lower.includes("garage") || lower.includes("mechanic") || lower.includes("puncture") || lower.includes("towing") || lower.includes("battery");
      // extract location via "near X" or known gazetteer names
      let locMatch: string | null = null;
      const nearMatch = input.message.match(/near\s+([A-Za-z\u0C00-\u0C7F]{3,})/i);
      if (nearMatch) locMatch = nearMatch[1];
      else {
        // try to find any known location name in the message
        const { searchLocations } = await import("../services/locationService");
        const words = input.message.split(/[\s,]+/).filter((w) => w.length >= 4);
        for (const w of words) {
          const locs = await searchLocations(w, 1);
          if (locs.length) { locMatch = locs[0].name; break; }
        }
        if (!locMatch) locMatch = intent.from || intent.to || null;
      }
      if (locMatch) {
        try {
          const tool = isDriver ? "search_drivers" : isGarage ? "search_garages" : "search_vehicles";
          const searchOut = await executeTool(tool, { location_text: locMatch } as Record<string, unknown>, { customerId: input.customerId, context: ctx, conversationId: conversation.id });
          const payload = { ...(searchOut.payloadPatch as ChatPayload) };
          const cards = (payload.cards || []) as ResultCard[];
          if (cards.length) {
            const kind = isDriver ? "drivers" : isGarage ? "garages" : "vehicles";
            const reply = `I found ${cards.length} ${kind} near ${locMatch}. The AI is in offline mode (no Gemini key), but these are real results from our marketplace — tap to book.`;
            const newCtx = { ...ctx, ...(searchOut.contextPatch as Partial<ChatContext>) };
            await saveContext(conversation.id, newCtx as ChatContext, conversation.title ?? input.message.slice(0, 40));
            await appendMessage(conversation.id, "assistant", reply, payload);
            return { conversationId: conversation.id, reply, payload, degraded: "no_api_key_fallback" };
          } else {
            // no results but location was found — still return a helpful message with no cards
            const reply = `I checked near ${locMatch} but found no ${isDriver ? "drivers" : isGarage ? "garages" : "vehicles"} right now. Try a nearby town or expand the search.`;
            await appendMessage(conversation.id, "assistant", reply, {});
            return { conversationId: conversation.id, reply, payload: {}, degraded: "no_api_key_fallback" };
          }
        } catch {}
      }
    } catch {}
    const reply =
      "The AI assistant is in offline mode (no Gemini key). I can still check your budget and find vehicles — try: “₹10000 Guntur to Tirupati 5 members Ertiga + driver” or “need a driver near Nandyal”. Meanwhile you can browse and book directly from the service pages.";
    await appendMessage(conversation.id, "assistant", reply);
    return { conversationId: conversation.id, reply, payload: emptyPayload, degraded: "no_api_key" };
  }

  const recent = await loadRecentMessages(conversation.id, 12);
  const contents: Content[] = [];
  for (const m of recent.slice(0, -1)) {
    contents.push({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] });
  }
  contents.push({ role: "user", parts: [{ text: input.message }] });

  const systemPrompt = buildSystemPrompt({
    nowISO: new Date().toISOString(),
    pageContext: input.pageContext,
    contextSummary: contextSummaryForChat(ctx),
    customerName: input.customerName || undefined,
  });

  const toolCtx = { customerId: input.customerId, context: ctx, conversationId: conversation.id };
  const payloadAcc: ChatPayload = {};
  let contextMut = { ...ctx };

  const outcome = await runWithTools({
    systemInstruction: systemPrompt,
    contents,
    tools: TOOLS,
    execute: async (name, args) => {
      const out = await executeTool(name, args as any, toolCtx);
      Object.assign(payloadAcc, out.payloadPatch);
      contextMut = { ...contextMut, ...out.contextPatch };
      return out.result;
    },
  });

  let reply: string;
  if (!outcome.ok) {
    reply =
      "I couldn't verify that right now — my assistant service hiccupped. Let me try again in a moment, or you can browse options on this page.";
    await track("ai_error", { error: outcome.error }, { conversationId: conversation.id });
  } else {
    reply = outcome.text?.trim() || "Here's what I found.";
  }

  // Final validation pass (§92): drop cards whose provider went inactive/unavailable
  if (payloadAcc.cards?.length) {
    const provIds = [...new Set(payloadAcc.cards.map((c) => c.providerId))];
    const providers = await prisma.provider.findMany({ where: { id: { in: provIds } } });
    const pmap = new Map(providers.map((p) => [p.id, p]));
    payloadAcc.cards = payloadAcc.cards.filter((c) => {
      const p = pmap.get(c.providerId);
      return p && p.status === "ACTIVE" && (p.availabilityStatus !== "OFFLINE");
    });
    if (payloadAcc.cards.length === 0) {
      reply += "\n\nHmm — those options just became unavailable. Try searching again.";
    }
  }

  await saveContext(conversation.id, contextMut, conversation.title ?? input.message.slice(0, 40));
  await appendMessage(conversation.id, "assistant", reply, payloadAcc);

  return { conversationId: conversation.id, reply, payload: payloadAcc };
}
