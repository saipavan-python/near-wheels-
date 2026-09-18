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
import { buildSuggestions } from "./suggestions";
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
import { FREE_MODE } from "../config";
import type { ResultCard, SearchFilters, SortPriority, PriceQuote } from "../types";

/** Marketplace booking engine only handles these listing kinds (guarded at runtime). */
type CreateBookingListingKind = "VEHICLE" | "DRIVER" | "GARAGE" | "FARM" | "DRONE";

export interface OrchestratorInput {
  message: string;
  conversationId?: string;
  sessionKey: string;
  customerId?: string | null;
  customerName?: string | null;
  pageContext?: string;
  userLocation?: { lat: number; lng: number; label: string } | null;
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

        // "current location" / "my location" / "near me" → use the GPS the user shared
        const curLoc = ctx.context.userLocation;
        const locText = String(args.location_text || "").toLowerCase().trim();
        const curAliases = ["current location", "my location", "my current location", "here", "near me", "gps", "my gps", "use my location"];
        if (curLoc && (!f.locationText || curAliases.includes(locText))) {
          f.lat = curLoc.lat;
          f.lng = curLoc.lng;
          f.locationText = curLoc.label || "Current location";
        }

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
              open_label: c.kind === "GARAGE" ? (c.meta.openLabel as string) || undefined : undefined,
              open_detail: c.kind === "GARAGE" ? (c.meta.openDetail as string) || undefined : undefined,
              emergency: c.kind === "GARAGE" ? (c.meta.emergency as boolean) || false : undefined,
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

      case "search_yatra_buses": {
        const { publicPackage } = await import("../services/yatraService");
        const pkgs = await prisma.yatraBusPackage.findMany({
          where: { status: "PUBLISHED", isPublished: true, isActive: true },
          include: {
            operator: true,
            vehicle: true,
            driver: { include: { provider: true } },
            stops: { orderBy: { order: "asc" as const } },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        });
        const items: ResultCard[] = pkgs.map((p) => {
          const pub = publicPackage(p) as any;
          return {
            kind: "BUS",
            id: p.id,
            providerId: p.operatorId,
            title: p.packageName,
            subtitle: `Yatra · ${p.stops[0]?.name || "Onwards"} → ${p.stops[p.stops.length - 1]?.name || "Onwards"}${
              p.durationDays ? ` · ${p.durationDays}D` : ""
            }`,
            category: "BUS",
            distanceKm: null,
            etaMin: null,
            availableNow: pub.availableSeats > 0,
            priceLabel: `₹${p.pricePerHead}/head`,
            priceFrom: p.pricePerHead,
            rating: pub.operator?.rating || 0,
            verified: Boolean(pub.operator?.verified),
            badges: [{ label: pub.availableSeats > 0 ? `${pub.availableSeats} seats` : "Sold out", icon: "🎟" }],
            reason: undefined,
            emoji: "🚌",
            meta: { kind: "BUS", from: pub.stops?.[0]?.name, to: pub.stops?.[pub.stops.length - 1]?.name, departure: pub.departureDate, returnDate: pub.returnDate, seats: pub.totalSeats, operator: pub.operator?.name },
          };
        });
        const patch: Partial<ChatPayload> = { cards: items };
        return {
          result: { found: items.length, results: items.map((c, i) => ({ index: i + 1, title: c.title, seats: c.meta.seats, price: c.priceLabel, available_now: c.availableNow })) },
          payloadPatch: patch,
          contextPatch: { lastResults: items, lastSearchKind: "VEHICLES", selected: undefined },
        };
      }

      case "search_driving_schools": {
        const { searchDrivingSchools } = await import("../services/drivingSchoolService");
        const curLoc = ctx.context.userLocation;
        const schools = await searchDrivingSchools({
          city: args.city || undefined,
          courseType: args.course_type || undefined,
          transmission: args.transmission || undefined,
          lat: curLoc?.lat || undefined,
          lng: curLoc?.lng || undefined,
          radiusKm: curLoc && !args.city ? 120 : undefined,
        });
        const items: ResultCard[] = schools.map((s: any) => ({
          kind: "DRIVING_SCHOOL",
          id: s.id,
          providerId: s.id,
          title: s.schoolName,
          subtitle: `${s.city || "Learn driving"} · ${Array.isArray(s.services) ? s.services.slice(0, 3).join(", ") : "Licensed training"}`,
          category: "DRIVING_SCHOOL",
          distanceKm: s.distance ?? null,
          etaMin: null,
          availableNow: true,
          priceLabel: s.priceFrom ? `₹${s.priceFrom}` : "Enquire",
          priceFrom: s.priceFrom || null,
          rating: s.rating || 0,
          verified: true,
          badges: [{ label: "Driving School", icon: "🎓" }],
          reason: s.rating ? `Rated ${s.rating.toFixed(1)} by learners` : undefined,
          emoji: "🚗",
          meta: { kind: "DRIVING_SCHOOL", school: s.schoolName, city: s.city, priceFrom: s.priceFrom, courses: s.services },
        }));
        const patch: Partial<ChatPayload> = { cards: items };
        return {
          result: { found: items.length, results: items.map((c, i) => ({ index: i + 1, title: c.title, city: c.meta.city, priceFrom: c.priceFrom, distance: c.distanceKm })) },
          payloadPatch: patch,
          contextPatch: { lastResults: items, lastSearchKind: "DRIVERS", selected: undefined },
        };
      }

      case "search_share_rides": {
        const rides = await prisma.sharedRide.findMany({
          where: { status: { in: ["ACTIVE", "IN_PROGRESS"] } },
          orderBy: { createdAt: "desc" },
          take: 10,
        });
        const items: ResultCard[] = rides.map((r) => ({
          kind: "SHARE_RIDE",
          id: r.id,
          providerId: r.driverPhone || r.id,
          title: `${r.fromLocation} → ${r.toLocation}`,
          subtitle: `${r.travelDate || ""} ${r.departureTime || ""} · ${r.vehicleTitle || "Vehicle"}`,
          category: "SHARE_RIDE",
          distanceKm: null,
          etaMin: null,
          availableNow: r.availableSeats > 0,
          priceLabel: `₹${r.pricePerSeat}/seat`,
          priceFrom: r.pricePerSeat,
          rating: r.driverRating || 0,
          verified: Boolean(r.verified),
          badges: [
            { label: r.availableSeats > 0 ? `${r.availableSeats} seats` : "Full", icon: "🤝" },
            { label: r.driverName, icon: "🧑‍✈️" },
          ],
          reason: undefined,
          emoji: "🧑‍🤝‍🧑",
          meta: { kind: "SHARE_RIDE", from: r.fromLocation, to: r.toLocation, date: r.travelDate, time: r.departureTime, seatsLeft: r.availableSeats, driver: r.driverName, pricePerSeat: r.pricePerSeat },
        }));
        const patch: Partial<ChatPayload> = { cards: items };
        return {
          result: { found: items.length, results: items.map((c, i) => ({ index: i + 1, from: c.meta.from, to: c.meta.to, date: c.meta.date, price: c.priceLabel })) },
          payloadPatch: patch,
          contextPatch: { lastResults: items, lastSearchKind: "VEHICLES", selected: undefined },
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
        // Yatra/schools/shared-rides book on their own pages — don't force them through the marketplace engine.
        if (["BUS", "DRIVING_SCHOOL", "SHARE_RIDE"].includes(card.kind)) {
          return {
            result: { error: `${card.title} is booked on its dedicated page — I've opened it for you.` },
            payloadPatch: { noResults: false },
            contextPatch: {},
          };
        }
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
          listingKind: card.kind as CreateBookingListingKind,
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
                ? FREE_MODE
                  ? "Your booking is confirmed — no advance or payment needed right now."
                  : "Provider accepted. Payment can proceed; booking becomes CONFIRMED only after verified payment."
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

        // Find real vehicle candidates near origin (geo bounding box in SQL instead of full-table scan)
        const RADIUS_KM = 60;
        const latDelta = RADIUS_KM / 111;
        const lngDelta = RADIUS_KM / (111 * Math.max(0.2, Math.cos((rFrom.resolved.lat * Math.PI) / 180)));
        const allVehicles = await prisma.vehicle.findMany({
          where: {
            status: "ACTIVE",
            provider: {
              status: "ACTIVE",
              lat: { gte: rFrom.resolved.lat - latDelta, lte: rFrom.resolved.lat + latDelta },
              lng: { gte: rFrom.resolved.lng - lngDelta, lte: rFrom.resolved.lng + lngDelta },
            },
          },
          include: { provider: true },
          take: 100,
        });
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

/**
 * Deterministic fallback that runs WITHOUT Gemini (or when the Gemini API
 * errors / hits rate limits). The bot must ALWAYS answer — budget trips via
 * plan_trip_with_budget, otherwise a direct marketplace search. Only runs the
 * real platform services in a transaction, never fabricated data.
 */
async function runOfflineFallback(
  input: OrchestratorInput,
  ctx: ChatContext,
  conversation: { id: string; title: string | null },
  mode: "no_key" | "api_error"
): Promise<{ conversationId: string; reply: string; payload: ChatPayload; degraded: string }> {
  const deg = (s: string) => (mode === "no_key" ? `no_api_key_${s}` : `api_error_${s}`);
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
      payload.suggestions = buildSuggestions(newCtx as ChatContext, payload);
      await saveContext(conversation.id, newCtx as ChatContext, conversation.title ?? input.message.slice(0, 40));
      await appendMessage(conversation.id, "assistant", reply, payload);
      return { conversationId: conversation.id, reply, payload, degraded: deg("fallback") };
    }
    // Fallback: try a simple search near the mentioned location (or the shared GPS)
    const lower = input.message.toLowerCase();
    const isDriver = lower.includes("driver") || lower.includes("drivr") || lower.includes("chauffeur");
    const isGarage = lower.includes("garage") || lower.includes("mechanic") || lower.includes("puncture") || lower.includes("towing") || lower.includes("battery") || lower.includes("repair") || lower.includes("breakdown");
    const isFarm = lower.includes("tractor") || lower.includes("farm") || lower.includes("acre") || lower.includes("plough");
    const isDrone = lower.includes("drone") || lower.includes("spray");
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
      // intent from/to only counts if it is a real gazetteer place (avoids
      // regex noise like "booking?" → "ng" being used as a location)
      if (!locMatch && (intent.from || intent.to)) {
        const cand = (intent.from || intent.to) as string;
        const check = await searchLocations(cand, 1);
        if (check.length) locMatch = check[0].name;
      }
    }
    if (locMatch || ctx.userLocation) {
      try {
        const tool = isDriver
          ? "search_drivers"
          : isGarage
          ? "search_garages"
          : isFarm
          ? "search_farm_equipment"
          : isDrone
          ? "search_drone_operators"
          : "search_vehicles";
        const searchOut = await executeTool(tool, { location_text: locMatch || undefined } as Record<string, unknown>, { customerId: input.customerId, context: ctx, conversationId: conversation.id });
        const payload = { ...(searchOut.payloadPatch as ChatPayload) };
        const cards = (payload.cards || []) as ResultCard[];
        if (cards.length) {
          const kind = isDriver ? "drivers" : isGarage ? "garages" : isFarm ? "farm services" : isDrone ? "drone operators" : "vehicles";
          const note =
            mode === "no_key"
              ? "I'm currently answering from live marketplace data (offline mode), so these results are real — tap to book."
              : "These are live results from the marketplace — tap to book.";
          const reply = `I found ${cards.length} ${kind} near ${locMatch || "your location"}. ${note}`;
          const newCtx = { ...ctx, ...(searchOut.contextPatch as Partial<ChatContext>) };
          await saveContext(conversation.id, newCtx as ChatContext, conversation.title ?? input.message.slice(0, 40));
          await appendMessage(conversation.id, "assistant", reply, payload);
          return { conversationId: conversation.id, reply, payload, degraded: deg("fallback") };
        } else {
          // no results but location was found — still return a helpful message with no cards
          const reply = `I checked near ${locMatch || "your location"} but found no ${isDriver ? "drivers" : isGarage ? "garages" : isFarm ? "farm services" : isDrone ? "drone operators" : "vehicles"} right now. Try a nearby town or expand the search.`;
          await appendMessage(conversation.id, "assistant", reply, { suggestions: ["Search another town", "Budget trip plan", "Need a driver nearby"] });
          return { conversationId: conversation.id, reply, payload: { suggestions: ["Search another town", "Budget trip plan", "Need a driver nearby"] }, degraded: deg("fallback") };
        }
      } catch {}
    }
    // Knowledge-base retrieval ("RAG"): answer questions from grounded content when
    // no live search/budget applies — keeps offline mode genuinely useful.
    try {
      const { retrieveKnowledge } = await import("./knowledgeBase");
      const hit = retrieveKnowledge(input.message);
      if (hit) {
        const kbReply = hit.entry.answer;
        const payload: ChatPayload = { suggestions: hit.entry.suggestions || [] };
        await appendMessage(conversation.id, "assistant", kbReply, payload);
        return { conversationId: conversation.id, reply: kbReply, payload, degraded: deg("kb") };
      }
    } catch {}
  } catch {}
  const reply =
    mode === "no_key"
      ? "I'm Trip My Pal's assistant working in offline mode (no AI key) — I answer from my built-in knowledge plus live marketplace data. I can check your budget, find vehicles/drivers/garages near you, and answer questions about prices, bookings and policies. Just tell me what you need."
      : "I can check your budget and find vehicles, drivers and garages near you, or answer questions about prices, bookings and policies. Just tell me what you need — in English, Telugu or Hindi.";
  const offlinePayload: ChatPayload = { suggestions: ["Budget trip plan", "Find a vehicle near me", "I need a driver"] };
  await appendMessage(conversation.id, "assistant", reply, offlinePayload);
  return { conversationId: conversation.id, reply, payload: offlinePayload, degraded: mode === "no_key" ? "no_api_key" : "api_error" };
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
  // remember GPS the user shared this turn (used for "near me" searches)
  if (input.userLocation && !ctx.userLocation) ctx.userLocation = input.userLocation;
  await appendMessage(conversation.id, "user", input.message);
  await track("ai_intent", { page: input.pageContext, text: input.message.slice(0, 120) }, { conversationId: conversation.id });

  if (!process.env.GEMINI_API_KEY) return runOfflineFallback(input, ctx, conversation, "no_key");

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
    userLocation: ctx.userLocation || null,
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

  if (!outcome.ok) {
    console.error("[ai] generate failed:", outcome.error);
    await track("ai_error", { error: outcome.error }, { conversationId: conversation.id });
    // Gemini down / rate-limited: fall back to the deterministic engine so the bot ALWAYS answers.
    return runOfflineFallback(input, ctx, conversation, "api_error");
  }
  let reply: string = outcome.text?.trim() || "Here's what I found.";

// Final validation pass (§92): drop cards whose provider went inactive/unavailable
  // (only applies to marketplace listings — yatra/schools/shared rides aren't provider-owned)
  const PROVIDER_KINDS = ["VEHICLE", "DRIVER", "GARAGE", "FARM", "DRONE"];
  if (payloadAcc.cards?.length) {
    const providerCards = payloadAcc.cards.filter((c) => PROVIDER_KINDS.includes(c.kind));
    const otherCards = payloadAcc.cards.filter((c) => !PROVIDER_KINDS.includes(c.kind));
    if (providerCards.length) {
      const provIds = [...new Set(providerCards.map((c) => c.providerId))];
      const providers = await prisma.provider.findMany({ where: { id: { in: provIds } } });
      const pmap = new Map(providers.map((p) => [p.id, p]));
      payloadAcc.cards = [
        ...otherCards,
        ...providerCards.filter((c) => {
          const p = pmap.get(c.providerId);
          return p && p.status === "ACTIVE" && p.availabilityStatus !== "OFFLINE";
        }),
      ];
      if (payloadAcc.cards.length === 0) {
        reply += "\n\nHmm — those options just became unavailable. Try searching again.";
      }
    }
  }

  payloadAcc.suggestions = buildSuggestions(contextMut, payloadAcc);
  await saveContext(conversation.id, contextMut, conversation.title ?? input.message.slice(0, 40));
  await appendMessage(conversation.id, "assistant", reply, payloadAcc);

  return { conversationId: conversation.id, reply, payload: payloadAcc };
}
