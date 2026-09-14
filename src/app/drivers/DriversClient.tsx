"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, Star, BadgeCheck, Award, Languages, Clock, ShieldCheck, Filter, X, Navigation, Loader2, Check, CarFront, Sparkles, CalendarClock } from "lucide-react";
import { api } from "@/lib/ui";
import type { ResultCard, SearchResult } from "@/lib/ui";
import LocationPicker from "@/components/LocationPicker";
import ResultCardView, { CardSkeleton } from "@/components/ResultCardView";
import BookingSheet from "@/components/BookingSheet";
import { portraitImage } from "@/lib/imagery";

const SORTS = [
  { id: "BEST_MATCH", label: "Best Match" },
  { id: "NEAREST", label: "Nearest" },
  { id: "CHEAPEST", label: "Cheapest" },
  { id: "BEST_RATED", label: "Best Rated" },
] as const;

export default function DriversClient() {
  const [loc, setLoc] = useState<{ label: string; lat?: number; lng?: number } | null>(null);
  const [sort, setSort] = useState("BEST_MATCH");
  const [when, setWhen] = useState("");
  const [driveCat, setDriveCat] = useState("ALL");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ambiguous, setAmbiguous] = useState<{ id: string; label: string; lat: number; lng: number }[] | null>(null);
  const [booking, setBooking] = useState<ResultCard | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const runSearch = useCallback(async (override?: Partial<{ locationText: string; lat: number; lng: number }>) => {
    if (!loc && !override?.lat && !override?.locationText) {
      setError("Where do you need a driver? Pick your location above.");
      return;
    }
    setLoading(true);
    setError(null);
    setAmbiguous(null);
    const p = new URLSearchParams();
    p.set("type", "drivers");
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
    if (when) p.set("scheduledFor", new Date(`${when}T09:00:00`).toISOString());
    if (driveCat !== "ALL") p.set("category", driveCat);
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
  }, [loc, sort, when, driveCat]);

  useEffect(() => {
    if (loc) runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc]);

  useEffect(() => {
    if (result && !loading) runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, when, driveCat]);

  return (
    <div className="pb-24">
      {/* Premium hero — driver focused */}
      <section className="relative overflow-hidden bg-ink text-white">
        <img src={portraitImage("driver-hero")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/50" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
        <div className="container-nw relative pb-12 pt-8 sm:pb-16 sm:pt-12">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-brand-300 ring-1 ring-white/15 backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified drivers
            </p>
            <h1 className="mt-3 max-w-2xl font-display text-[28px] font-extrabold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
              Someone you can <span className="text-brand-400">trust</span> behind the wheel.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
              Your car, our driver — hourly or daily. Verified licences, rated trips, GPS-tracked. Tell us where, we find who’s near.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-medium text-white/80 ring-1 ring-white/10"><Award className="h-3.5 w-3.5 text-brand-400" /> 5+ yrs avg experience</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-medium text-white/80 ring-1 ring-white/10"><Star className="h-3.5 w-3.5 text-amber-400" /> 4.7 avg rating</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-medium text-white/80 ring-1 ring-white/10"><Languages className="h-3.5 w-3.5" /> Telugu • Hindi • English</span>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="container-nw relative z-10 -mt-6 sm:-mt-8">
        {/* Sticky search — mobile thumb reach */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="card sticky top-[72px] z-20 p-4 shadow-lift sm:static sm:p-5"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <LocationPicker value={loc?.label} onPick={setLoc} />
            <button
              className="btn-primary min-h-[48px] !py-3 text-base font-bold shadow-sm active:scale-[0.98]"
              onClick={() => runSearch()}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4" /> Find drivers</>}
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
            <label className="flex items-center gap-2 text-xs font-semibold text-ink">
              <CalendarClock className="h-4 w-4 text-brand-500" />
              When do you need it?
            </label>
            <input
              type="date"
              className="input !h-10 !px-3"
              value={when}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setWhen(e.target.value)}
              aria-label="When do you need the driver"
            />
            <p className="text-xs text-ink-faint">{when ? "We'll only show drivers free on that date." : "Blank = today / as soon as possible."}</p>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-ink-faint">We search within ~15km and expand to 60km if needed.</p>
            <button onClick={() => setShowFilters(!showFilters)} className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-semibold text-ink-mute hover:border-brand-400">
              <Filter className="h-3.5 w-3.5" /> Filters
            </button>
          </div>
          <AnimatePresence>
            {showFilters && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                <div className="mt-4 space-y-3 border-t border-ink/5 pt-4 text-xs">
                  <div>
                    <p className="font-bold">Drives (vehicle type)</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(["ALL", "CAR", "SUV", "TRUCK", "LORRY", "VAN", "BUS", "AUTO", "TRACTOR"] as const).map((c) => (
                        <button
                          key={c}
                          onClick={() => setDriveCat(c)}
                          aria-pressed={driveCat === c}
                          className={`rounded-full border px-3 py-1.5 font-bold transition ${driveCat === c ? "border-brand-600 bg-brand-600 text-white" : "border-ink/10 bg-white text-ink-mute hover:border-brand-400"}`}
                        >
                          {c === "ALL" ? "Any" : c}
                        </button>
                      ))}
                    </div>
                  </div>
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
            <div className="flex gap-2 text-xs font-medium text-ink-mute"><Loader2 className="h-4 w-4 animate-spin text-brand-500" /> Finding verified drivers near you...</div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <CardSkeleton /><CardSkeleton /><CardSkeleton />
            </div>
          </div>
        )}

        {!loading && result && (
          <section className="mt-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight sm:text-xl">
                  {result.items.length ? `Found ${result.items.length} drivers near ${loc?.label?.split(",")[0] || "you"}` : "No drivers right now"}
                </h2>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-mute">
                  <Navigation className="h-3 w-3" /> Searched ~{result.searchedRadiusKm}km • Verified & rated first
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

            {result.items.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card mt-6 overflow-hidden p-0 text-center">
                <img src={portraitImage("empty-drivers")} alt="" className="h-40 w-full object-cover opacity-70" />
                <div className="p-6">
                  <h3 className="font-display text-lg font-bold">No drivers right now</h3>
                  <p className="mx-auto mt-1 max-w-md text-sm text-ink-mute">Drivers go online through the day. Try expanding search or check back soon.</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button className="btn-primary !py-2" onClick={() => runSearch()}>Retry</button>
                    <a href="/" className="btn-outline !py-2">Ask AI</a>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                initial="hidden"
                animate="visible"
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
              >
                {result.items.map((c, i) => (
                  <motion.div
                    key={c.id}
                    variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } } }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <article className="group relative overflow-hidden rounded-2xl border border-ink/[0.06] bg-white shadow-card transition hover:shadow-lift">
                      <div className="relative h-28 bg-gradient-to-br from-ink via-ink-soft to-brand-900 p-4">
                        <img src={portraitImage(c.id)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
                        <div className="relative flex items-start justify-between">
                          <span className={`badge ${c.availableNow ? "bg-emerald-500 text-white" : "bg-white/20 text-white backdrop-blur"} px-3 py-1`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-white" /> {c.availableNow ? "Available now" : "On schedule"}
                          </span>
                          {c.verified && <span className="badge bg-white text-emerald-700 px-2.5 py-1"><BadgeCheck className="h-3.5 w-3.5" /> Verified</span>}
                        </div>
                        <div className="absolute -bottom-8 left-4 flex items-end gap-3">
                          <img src={portraitImage(c.id)} alt={c.title} className="h-16 w-16 rounded-2xl border-2 border-white object-cover shadow-md" />
                          <div className="pb-1">
                            <h3 className="font-display text-base font-bold leading-none text-white">{c.title}</h3>
                            <p className="text-xs font-medium text-white/70">{c.subtitle}</p>
                          </div>
                        </div>
                      </div>
                      <div className="px-4 pb-4 pt-10">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          {c.distanceKm != null && <span className="inline-flex items-center gap-1 rounded-full bg-paper-deep px-2.5 py-1 font-semibold"><MapPin className="h-3 w-3 text-brand-600" />{c.distanceKm.toFixed(1)}km • {c.etaMin} min</span>}
                          {c.rating > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-bold text-amber-800"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{c.rating.toFixed(1)}</span>}
                          {c.badges.slice(0,1).map(b=> <span key={b.label} className="badge bg-sky-50 text-sky-700">{b.label}</span>)}
                        </div>
                        {c.reason && <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-brand-50 px-3 py-2 text-xs font-medium text-brand-900"><Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-500" />{c.reason}</p>}
                        <div className="mt-4 flex items-center justify-between border-t border-ink/[0.06] pt-3">
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">From</p>
                            <p className="font-display text-lg font-extrabold tracking-tight text-ink">{c.priceLabel}</p>
                          </div>
                          <button onClick={() => setBooking(c)} className="btn-primary min-h-[44px] !rounded-xl !px-5 !py-2.5 text-sm font-bold active:scale-[0.98]">
                            Book
                          </button>
                        </div>
                      </div>
                    </article>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </section>
        )}

        {!loading && !result && !ambiguous && !error && (
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card mt-6 overflow-hidden p-0 text-center">
            <img src={portraitImage("empty-drivers")} alt="" className="h-44 w-full object-cover opacity-60" />
            <div className="p-8">
              <h2 className="font-display text-lg font-bold">Find a driver near you</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-ink-mute">Pick your village or current location — we find verified drivers with live availability and clear daily pricing.</p>
            </div>
          </motion.section>
        )}
      </div>

      {booking && <BookingSheet card={booking} onClose={() => setBooking(null)} />}
    </div>
  );
}
