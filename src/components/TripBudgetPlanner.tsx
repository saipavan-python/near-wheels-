"use client";

import { useEffect, useState } from "react";
import { api, getCurrentPosition } from "@/lib/ui";
import type { ResultCard, SearchResult } from "@/lib/ui";
import BudgetTripCard from "./BudgetTripCard";
import LocationPicker, { type PickedLocation } from "./LocationPicker";
import ResultCardView from "./ResultCardView";
import BookingSheet from "./BookingSheet";
import { Coins, MapPin, Search, Navigation, Loader2, LocateFixed } from "lucide-react";

interface TripPlanResponse {
  intent: { budget: number | null; from: string | null; to: string | null; pax: number | null; days: number; roundTrip: boolean; vehicleCategory: string | null; vehicleModel: string | null; withDriver: boolean };
  distance: { oneWayKm: number; totalKm: number; roundTrip: boolean; source: string; note: string; estimatedTimeMin: number };
  options: Array<{ rank: string; vehicleId: string | null; title: string; category: string; total: number; confidence: string; disclaimer: string; lines: { label: string; amount: number; confidence: "CONFIRMED" | "ESTIMATE" | "PROVIDER_CONFIRMATION"; source: string; note?: string }[] }>;
  cheapest: { vehicleId: string | null; title: string; total: number; confidence: string } | null;
  budgetComparison: { budget: number; estimatedTotal: number; delta: number; possible: boolean; confidence: string; disclaimer: string } | null;
  message: string;
}

export default function TripBudgetPlanner({ compact }: { compact?: boolean }) {
  const [budget, setBudget] = useState("10000");
  const [fromLoc, setFromLoc] = useState<PickedLocation | null>(null);
  const [toLoc, setToLoc] = useState<PickedLocation | null>(null);
  const [pax, setPax] = useState("5");
  const [days, setDays] = useState("2");
  const [withDriver, setWithDriver] = useState(true);
  const [model, setModel] = useState("Ertiga");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TripPlanResponse | null>(null);
  const [cards, setCards] = useState<ResultCard[]>([]);
  const [bookingCard, setBookingCard] = useState<ResultCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locatingFrom, setLocatingFrom] = useState(false);
  const [fromTextFallback, setFromTextFallback] = useState("");
  const [toTextFallback, setToTextFallback] = useState("");

  // auto-try live location for From on mount (best for rural users — one tap)
  useEffect(() => {
    // do not auto-prompt; user taps "Use live location" explicitly
  }, []);

  async function useLiveFrom() {
    setLocatingFrom(true);
    setError(null);
    try {
      const { lat, lng } = await getCurrentPosition();
      const loc: PickedLocation = { label: "My location", lat, lng };
      setFromLoc(loc);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not get live location";
      setError(msg + " — you can pick your village/town below.");
    }
    setLocatingFrom(false);
  }

  async function plan() {
    setLoading(true);
    setError(null);
    setResult(null);
    setCards([]);

    // build payload — prefer live lat/lng, fallback to text label
    const fromPayload: Record<string, unknown> = {};
    if (fromLoc?.lat != null && fromLoc?.lng != null) {
      fromPayload["fromLat"] = fromLoc.lat;
      fromPayload["fromLng"] = fromLoc.lng;
      fromPayload["from"] = fromLoc.label;
    } else if (fromTextFallback.trim()) {
      fromPayload["from"] = fromTextFallback.trim();
    } else if (fromLoc?.label) {
      fromPayload["from"] = fromLoc.label;
    }

    const toPayload: Record<string, unknown> = {};
    if (toLoc?.lat != null && toLoc?.lng != null) {
      toPayload["toLat"] = toLoc.lat;
      toPayload["toLng"] = toLoc.lng;
      toPayload["to"] = toLoc.label;
    } else if (toTextFallback.trim()) {
      toPayload["to"] = toTextFallback.trim();
    } else if (toLoc?.label) {
      toPayload["to"] = toLoc.label;
    }

    const r = await api<TripPlanResponse>("/api/ai/trip-plan", {
      json: {
        budget: Number(budget) || undefined,
        ...fromPayload,
        ...toPayload,
        pax: Number(pax) || undefined,
        days: Number(days) || undefined,
        vehicleModel: model.trim() || undefined,
        withDriver,
        roundTrip: Number(days) >= 2,
      },
    });
    // fetch live vehicle cards near From for booking (end-to-end)
    let fetchedCards: ResultCard[] = [];
    try {
      if (fromLoc?.lat != null || fromPayload["from"]) {
        const params = new URLSearchParams({ type: "vehicles", sortBy: "BEST_MATCH" });
        if (fromLoc?.lat != null && fromLoc?.lng != null) {
          params.set("lat", String(fromLoc.lat));
          params.set("lng", String(fromLoc.lng));
        } else if (fromPayload["from"]) {
          params.set("locationText", String(fromPayload["from"]));
        }
        if (model.trim()) params.set("model", model.trim());
        if (pax) params.set("seats", pax);
        if (withDriver) params.set("rentalMode", "WITH_DRIVER");
        const sr = await api<{ result: SearchResult }>(`/api/search?${params.toString()}`);
        if (sr.ok) fetchedCards = sr.data.result.items.slice(0, 4);
      }
    } catch {}

    setLoading(false);
    if (!r.ok) {
      const msg = (r.data as unknown as { error?: string; message?: string }).error || (r.data as unknown as { message?: string }).message || "Could not plan trip. Check locations.";
      const opts = (r.data as unknown as { options?: { label: string }[] }).options;
      if (opts && opts.length) {
        setError(msg + " Options: " + opts.map((o) => o.label).join(", "));
      } else {
        setError(msg);
      }
      // still show cards if we fetched them
      if (fetchedCards.length) setCards(fetchedCards);
      return;
    }
    setResult(r.data as unknown as TripPlanResponse);
    if (fetchedCards.length) setCards(fetchedCards);
  }

  return (
    <div className={`card p-4 sm:p-5 ${compact ? "" : "shadow-lift"}`}>
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600"><Coins className="h-5 w-5" /></span>
        <div>
          <h3 className="text-base font-extrabold tracking-tight">Budget Trip Planner</h3>
          <p className="text-xs text-slate-500">Check if your trip fits your budget — fuel + toll estimated, vehicle confirmed.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Budget (₹)</span>
          <input className="input" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 10000" />
        </label>
        <label className="block">
          <span className="label">Passengers</span>
          <input className="input" inputMode="numeric" value={pax} onChange={(e) => setPax(e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 5" />
        </label>
        <div className="block sm:col-span-2">
          <span className="label flex items-center justify-between">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> From (live location recommended)</span>
            <button type="button" onClick={useLiveFrom} disabled={locatingFrom} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100 disabled:opacity-50">
              {locatingFrom ? <Loader2 className="h-3 w-3 animate-spin" /> : <LocateFixed className="h-3 w-3" />} Use live location
            </button>
          </span>
          <LocationPicker value={fromLoc?.label || fromTextFallback || undefined} onPick={(loc) => { setFromLoc(loc); setFromTextFallback(""); }} />
          {!fromLoc?.lat && (
            <input className="input mt-2" value={fromTextFallback} onChange={(e) => setFromTextFallback(e.target.value)} placeholder="Or type village/town, e.g. Yerragunta bus stand pakkana" />
          )}
          {fromLoc?.lat != null && fromLoc.lng != null && <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700"><Navigation className="h-3 w-3" /> Live: {fromLoc.label} ({fromLoc.lat.toFixed(4)}, {fromLoc.lng!.toFixed(4)})</p>}
        </div>
        <div className="block sm:col-span-2">
          <span className="label flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-brand-500" /> To</span>
          <LocationPicker value={toLoc?.label || toTextFallback || undefined} onPick={(loc) => { setToLoc(loc); setToTextFallback(""); }} />
          {!toLoc?.lat && (
            <input className="input mt-2" value={toTextFallback} onChange={(e) => setToTextFallback(e.target.value)} placeholder="Destination, e.g. Tirupati / Nandyal railway station" />
          )}
        </div>
        <label className="block">
          <span className="label">Days</span>
          <input className="input" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 2" />
        </label>
        <label className="block">
          <span className="label">Vehicle (optional)</span>
          <input className="input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Ertiga, Innova, auto..." />
        </label>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={withDriver} onChange={(e) => setWithDriver(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
        Need driver
      </label>

      <button
        onClick={plan}
        disabled={loading || !budget || (!fromLoc && !fromTextFallback.trim()) || (!toLoc && !toTextFallback.trim())}
        className="btn-primary mt-4 w-full !py-3 disabled:opacity-50"
      >
        {loading ? "Calculating…" : <><Search className="h-4 w-4" /> Check budget feasibility</>}
      </button>
      <p className="mt-2 text-center text-[11px] text-slate-400">Uses live GPS when you tap “Use live location” — no typing needed for From.</p>

      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {result && result.budgetComparison && result.options[0] && (
        <div className="mt-4 space-y-4">
          <BudgetTripCard
            budget={result.budgetComparison.budget}
            estimatedTotal={result.budgetComparison.estimatedTotal}
            delta={result.budgetComparison.delta}
            possible={result.budgetComparison.possible}
            confidence={result.budgetComparison.confidence}
            disclaimer={result.budgetComparison.disclaimer}
            distance={result.distance as unknown as { oneWayKm: number; totalKm: number; roundTrip: boolean; source: string } | null}
            lines={result.options[0].lines}
            from={result.intent.from}
            to={result.intent.to}
            pax={result.intent.pax}
            days={result.intent.days}
          />
          {result.options.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Other options</p>
              {result.options.slice(1).map((o, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <span className="font-semibold">{o.title}</span>
                  <span className="font-bold">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(o.total)}</span>
                </div>
              ))}
            </div>
          )}
          {/* End-to-end: real vehicles near live From — tap to book */}
          {cards.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Available near {fromLoc?.label || result.intent.from} — tap to book</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {cards.map((c) => (
                  <ResultCardView key={c.id} card={c} compact onBook={setBookingCard} />
                ))}
              </div>
              <a href="/vehicles" className="mt-2 inline-flex text-xs font-semibold text-brand-700 hover:underline">See all vehicles →</a>
            </div>
          )}
          {cards.length === 0 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">No vehicles found exactly matching {model || "your filters"} near your location — try clearing vehicle filter or expand search.</p>
          )}
        </div>
      )}

      {result && !result.budgetComparison && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{result.message}</div>
      )}

      {/* Show cards even when budget check failed due to location error */}
      {!result && cards.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Available near you</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {cards.map((c) => (
              <ResultCardView key={c.id} card={c} compact onBook={setBookingCard} />
            ))}
          </div>
        </div>
      )}

      {bookingCard && <BookingSheet card={bookingCard} onClose={() => setBookingCard(null)} />}
    </div>
  );
}
