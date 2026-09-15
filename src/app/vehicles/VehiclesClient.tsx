"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, Star, BadgeCheck, CarFront, Gauge, Fuel, Snowflake, Users, SlidersHorizontal, Navigation, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "@/lib/ui";
import type { ResultCard, SearchResult } from "@/lib/ui";
import LocationPicker from "@/components/LocationPicker";
import ResultCardView, { CardSkeleton } from "@/components/ResultCardView";
import BookingSheet from "@/components/BookingSheet";
import { vehicleImage } from "@/lib/imagery";

const QUICK_FILTERS = [
  { label: "All", params: {} },
  { label: "Cars", params: { category: "CAR" } },
  { label: "Autos", params: { category: "AUTO" } },
  { label: "Bikes", params: { category: "BIKE" } },
  { label: "Scooters", params: { category: "SCOOTER" } },
  { label: "SUVs", params: { category: "SUV" } },
  { label: "Vans", params: { category: "VAN" } },
  { label: "Pickups", params: { category: "PICKUP" } },
  { label: "Trucks", params: { category: "TRUCK" } },
  { label: "Buses", params: { category: "BUS" } },
] as const;

const SORTS = [
  { id: "BEST_MATCH", label: "Best Match" },
  { id: "NEAREST", label: "Nearest" },
  { id: "CHEAPEST", label: "Cheapest" },
  { id: "BEST_RATED", label: "Best Rated" },
] as const;

export default function VehiclesClient() {
  const [loc, setLoc] = useState<{ label: string; lat?: number; lng?: number } | null>(null);
  const [quick, setQuick] = useState<Record<string, string>>({});
  const [sort, setSort] = useState("BEST_MATCH");
  const [model, setModel] = useState("");
  const [rentalMode, setRentalMode] = useState("");
  const [seats, setSeats] = useState("");
  const [ac, setAc] = useState<"" | "true" | "false">("");
  const [searchDate, setSearchDate] = useState<string>("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ambiguous, setAmbiguous] = useState<{ id: string; label: string; lat: number; lng: number }[] | null>(null);
  const [booking, setBooking] = useState<ResultCard | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Restore pending booking after login (spec §1: return to booking flow)
  useEffect(() => {
    const handler = () => {
      try {
        const raw = sessionStorage.getItem("nw_pending_booking");
        if (raw) {
          const pending = JSON.parse(raw);
          if (pending?.card) {
            setBooking(pending.card);
            sessionStorage.removeItem("nw_pending_booking");
          }
        }
      } catch {}
    };
    window.addEventListener("nw:auth", handler);
    window.addEventListener("nw:auth-booking-pending", handler as EventListener);
    // On mount, if already authed and pending exists, restore
    handler();
    return () => {
      window.removeEventListener("nw:auth", handler);
      window.removeEventListener("nw:auth-booking-pending", handler as EventListener);
    };
  }, []);

  const runSearch = useCallback(async (override?: Partial<{ locationText: string; lat: number; lng: number }>) => {
    if (!loc && !override?.lat && !override?.locationText) {
      setError("Where should I search? Pick your location above.");
      return;
    }
    setLoading(true);
    setError(null);
    setAmbiguous(null);
    const p = new URLSearchParams();
    p.set("type", "vehicles");
    p.set("sortBy", sort);
    const locText = override?.locationText ?? loc?.label ?? "";
    if (override?.lat != null && override?.lng != null) {
      p.set("lat", String(override.lat));
      p.set("lng", String(override.lng));
    } else if (loc?.lat != null && loc?.lng != null) {
      p.set("lat", String(loc.lat));
      p.set("lng", String(loc.lng));
    }
    if (!p.get("lat")) p.set("locationText", locText);
    for (const [k, v] of Object.entries(quick)) if (v) p.set(k, v);
    if (model.trim()) p.set("model", model.trim());
    if (rentalMode) p.set("rentalMode", rentalMode);
    if (seats) p.set("seats", seats);
    if (ac) p.set("ac", ac);
    if (searchDate) p.set("date", searchDate);
    const r = await api<{ result: SearchResult }>(`/api/search?${p.toString()}`);
    setLoading(false);
    if (r.status === 300 && (r.data as any).options) {
      setAmbiguous((r.data as any).options);
      setResult(null);
      return;
    }
    if (r.status === 422) {
      setError((r.data as any).message || "Tell me where to search.");
      setResult(null);
      return;
    }
    if (!r.ok) {
      setError((r.data as any).error || "Search failed. Please try again.");
      setResult(null);
      return;
    }
    setResult(r.data.result);
  }, [loc, quick, sort, model, rentalMode, seats, ac]);

  useEffect(() => {
    if (loc) runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc]);

  useEffect(() => {
    if (result && !loading) runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, quick, searchDate]);

  function toggleQuick(f: typeof QUICK_FILTERS[number]) {
    setQuick((prev) => {
      const active = JSON.stringify(prev) === JSON.stringify(f.params);
      return active ? {} : (f.params as Record<string, string>);
    });
  }

  return (
    <div className="pb-24">
      {/* Premium hero — vehicles */}
      <section className="relative overflow-hidden bg-ink text-white">
        <img src={vehicleImage("premium suv band", "SUV")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
        <div className="container-nw relative pb-12 pt-8 sm:pb-16 sm:pt-12">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
            <p className="eyebrow text-brand-400">Vehicles</p>
            <h1 className="mt-2 max-w-2xl font-display text-[28px] font-extrabold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
              Your next drive <span className="text-brand-400">starts here.</span>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
              Cars, autos, bikes, SUVs, vans, pickups and buses — self-drive or with driver, available now or later. Verified owners, clear pricing.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/80 ring-1 ring-white/10"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Verified</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/80 ring-1 ring-white/10"><Gauge className="h-3.5 w-3.5" /> Self-drive + driver</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/80 ring-1 ring-white/10"><Fuel className="h-3.5 w-3.5" /> Petrol • Diesel • CNG</span>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="container-nw relative z-10 -mt-6 sm:-mt-8">
        {/* Sticky search */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }} className="card sticky top-[72px] z-20 p-4 shadow-lift sm:static sm:p-5" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <LocationPicker value={loc?.label} onPick={setLoc} />
            <button className="btn-primary min-h-[48px] !py-3 text-base font-bold active:scale-[0.98]" onClick={() => runSearch()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4" /> Search</>}
            </button>
          </div>

          {/* Quick filters — premium chips */}
          <div className="mt-4 -mx-1 flex gap-2 overflow-x-auto px-1 py-1 hide-scrollbar">
            {QUICK_FILTERS.map((f) => {
              const active = JSON.stringify(quick) === JSON.stringify(f.params);
              return (
                <motion.button
                  key={f.label}
                  onClick={() => toggleQuick(f)}
                  aria-pressed={active}
                  whileTap={{ scale: 0.97 }}
                  className={`inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full border px-4 py-2.5 text-sm font-semibold transition ${active ? "border-brand-500 bg-brand-500 text-white shadow-sm" : "border-ink/15 bg-white text-ink-mute hover:border-brand-400 hover:text-brand-700"}`}
                >
                  {f.label}
                </motion.button>
              );
            })}
          </div>

          {/* Date filter for availability */}
          <div className="mt-4 rounded-2xl border border-ink/10 bg-paper p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">When do you need it?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { label: "Any date", value: "" },
                { label: "Today", value: new Date().toISOString().slice(0, 10) },
                { label: "Tomorrow", value: new Date(Date.now() + 86400000).toISOString().slice(0, 10) },
                { label: "Next 2 days", value: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setSearchDate(opt.value)}
                  className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition ${searchDate === opt.value ? "border-brand-600 bg-brand-600 text-white" : "border-ink/15 bg-white text-ink-mute hover:border-brand-400"}`}
                >
                  {opt.label}
                </button>
              ))}
              <input
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="rounded-full border border-ink/15 bg-white px-3 py-2 text-xs font-semibold"
                aria-label="Pick date"
              />
              {searchDate && <button onClick={() => setSearchDate("")} className="text-xs font-semibold text-brand-700">Clear</button>}
            </div>
            <p className="mt-1.5 text-xs text-ink-faint">{searchDate ? `Showing vehicles available on ${new Date(searchDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : "Showing vehicles available now — picks the closest available for today"}</p>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button onClick={() => setShowFilters(!showFilters)} className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-semibold text-ink-mute hover:border-brand-400">
              <SlidersHorizontal className="h-3.5 w-3.5" /> {showFilters ? "Hide filters" : "More filters"}
            </button>
            <p className="text-xs text-ink-faint">Tap a vehicle type above to filter</p>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink/5 pt-4 sm:grid-cols-4">
                  <input className="input h-12" placeholder="Model e.g. Innova" value={model} onChange={(e) => setModel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSearch()} aria-label="Vehicle model" />
                  <select className="input h-12" value={rentalMode} onChange={(e) => setRentalMode(e.target.value)} aria-label="Rental mode">
                    <option value="">Any mode</option>
                    <option value="SELF_DRIVE">Self-drive</option>
                    <option value="WITH_DRIVER">With driver</option>
                  </select>
                  <select className="input h-12" value={seats} onChange={(e) => setSeats(e.target.value)} aria-label="Seats">
                    <option value="">Any seats</option>
                    {[2, 3, 4, 5, 7, 12, 32].map((s) => <option key={s} value={s}>{s}+ seats</option>)}
                  </select>
                  <select className="input h-12" value={ac} onChange={(e) => setAc(e.target.value as any)} aria-label="AC">
                    <option value="">AC or not</option>
                    <option value="true">AC only</option>
                    <option value="false">Non-AC</option>
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {ambiguous && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card mt-4 border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Multiple places with that name — which one?</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ambiguous.map((o) => (
                <button key={o.id} className="btn-outline !py-2" onClick={() => { setAmbiguous(null); runSearch({ lat: o.lat, lng: o.lng, locationText: o.label }); }}>
                  <MapPin className="h-4 w-4 text-brand-500" /> {o.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {error && <p className="card mt-4 border-red-100 bg-red-50 p-4 text-sm text-red-700" role="alert">{error}</p>}

        {loading && (
          <div className="mt-6 space-y-4" aria-busy="true">
            <div className="flex items-center gap-2 text-xs font-medium text-ink-mute"><Loader2 className="h-4 w-4 animate-spin text-brand-500" /> Searching vehicles near you...</div>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <CardSkeleton /><CardSkeleton /><CardSkeleton />
            </div>
          </div>
        )}

        {!loading && result && (
          <section className="mt-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight sm:text-xl">
                  {result.items.length ? `Found ${result.items.length} vehicles near ${loc?.label?.split(",")[0] || "you"}` : "No exact match"}
                </h2>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-mute">
                  <Navigation className="h-3 w-3" /> Searched ~{result.searchedRadiusKm}km {result.showingAlternatives ? "• showing nearby alternatives" : ""}
                </p>
              </div>
              <div className="flex gap-1 rounded-full bg-paper-deep p-1">
                {SORTS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSort(s.id)}
                    aria-pressed={sort === s.id}
                    className={`min-h-[44px] rounded-full px-4 py-2 text-xs font-semibold transition ${sort === s.id ? "bg-ink text-white shadow" : "text-ink-mute hover:text-ink"}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {result.showingAlternatives && (
              <p className="mt-3 rounded-xl bg-sky-50 px-3.5 py-2.5 text-sm text-sky-900">Couldn’t find that exact model nearby — these are the closest available alternatives.</p>
            )}

            {result.items.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card mt-6 overflow-hidden p-0 text-center">
                <img src={vehicleImage("empty vehicles", "SUV")} alt="" className="h-40 w-full object-cover opacity-70" />
                <div className="p-6">
                  <h3 className="font-display text-lg font-bold">Nothing available right now</h3>
                  <p className="mx-auto mt-1 max-w-md text-sm text-ink-mute">Try a wider radius, clear filters or check back soon.</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button className="btn-primary !py-2" onClick={() => runSearch()}>Retry</button>
                    <button className="btn-outline !py-2" onClick={() => { setQuick({}); setModel(""); runSearch(); }}>Clear filters</button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}>
                {result.items.map((c) => (
                  <motion.div
                    key={c.id}
                    variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } } }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <ResultCardView card={c} bestMatch={false} onBook={setBooking} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </section>
        )}

        {!loading && !result && !ambiguous && !error && (
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card mt-6 overflow-hidden p-0 text-center">
            <img src={vehicleImage("empty vehicles", "SUV")} alt="" className="h-44 w-full object-cover opacity-60" />
            <div className="p-8">
              <h2 className="font-display text-lg font-bold">Your next drive starts with a place</h2>
              <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-mute">Pick your village, town or current location — we find real vehicles near you with live availability and clear prices.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 font-medium"><CarFront className="h-3.5 w-3.5" /> Cars</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 font-medium"><Users className="h-3.5 w-3.5" /> 7 seats</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 font-medium"><Snowflake className="h-3.5 w-3.5" /> AC</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 font-medium"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Verified</span>
              </div>
            </div>
          </motion.section>
        )}
      </div>

      {booking && <BookingSheet card={booking} presetDate={searchDate || undefined} onClose={() => setBooking(null)} />}
    </div>
  );
}
