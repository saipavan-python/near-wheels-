"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Search, MapPin, Sparkles, Star, IndianRupee, Scale, Check, Loader2,
  Car, Bike, Truck, Tractor, Wrench, BatteryCharging, CircleDot, Zap,
  Snowflake, Droplets, Sprout, Cpu, UserRound, LayoutGrid,
} from "lucide-react";
import type { ResultCard, SearchResult } from "@/lib/ui";
import { api } from "@/lib/ui";
import LocationPicker from "./LocationPicker";
import ResultCardView, { CardSkeleton } from "./ResultCardView";
import BookingSheet from "./BookingSheet";
import { IconX } from "./icons";
import { vehicleImage, portraitImage, garageImage, IMGS } from "@/lib/imagery";
import { motion, AnimatePresence } from "framer-motion";


export interface QuickFilter {
  label: string;
  icon: string; // key resolved against ICONS below (no emojis — spec rule)
  params: Record<string, string>; // merged into search query
}

export interface ServiceConfig {
  searchType: "vehicles" | "drivers" | "garages" | "farm" | "drones";
  eyebrow: string;
  title: string;
  subtitle: string;
  quickFilters?: QuickFilter[];
  vehicleFilters?: boolean; // seats / AC / rental mode
  acresField?: boolean; // farm & drone
  askModel?: boolean; // vehicles model text
  relatedLinks?: { label: string; href: string; icon: keyof typeof ICONS }[];
}

/** Icon registry for filter chips & related links (kept emoji-free). */
const ICONS = {
  all: LayoutGrid,
  car: Car,
  auto: CircleDot,
  bike: Bike,
  scooter: Zap,
  suv: Car,
  van: Truck,
  pickup: Truck,
  truck: Truck,
  bus: Truck,
  tractor: Tractor,
  trailer: Tractor,
  cultivator: Sprout,
  rotavator: Sprout,
  harvest: Sprout,
  water: Droplets,
  wash: Droplets,
  transport: Truck,
  mechanic: Wrench,
  towing: Truck,
  battery: BatteryCharging,
  tyre: CircleDot,
  electrical: Zap,
  ac: Snowflake,
  drone: Cpu,
  driver: UserRound,
} as const;

const SORTS = [
  { id: "BEST_MATCH", label: "Best Match", Icon: Sparkles },
  { id: "NEAREST", label: "Nearest", Icon: MapPin },
  { id: "CHEAPEST", label: "Cheapest", Icon: IndianRupee },
  { id: "BEST_RATED", label: "Best Rated", Icon: Star },
] as const;

function heroImage(type: string): string {
  switch (type) {
    case "drivers": return IMGS.driversHero;
    case "garages": return garageImage("garage-hero-band");
    case "farm": return IMGS.farmField;
    case "drones": return vehicleImage("crop spraying drone", "DRONE");
    default: return vehicleImage("premium suv band", "SUV");
  }
}

function heroTint(type: string): string {
  if (type === "farm") return "from-emerald-950/90 via-emerald-950/45 to-emerald-900/60";
  return "from-black/85 via-black/40 to-black/55";
}

function emptyImage(type: string): string {
  switch (type) {
    case "drivers": return portraitImage("empty-drivers");
    case "garages": return garageImage("empty-garages");
    case "farm": return vehicleImage("empty farm", "TRACTOR");
    case "drones": return vehicleImage("empty drone", "DRONE");
    default: return vehicleImage("empty vehicles", "SUV");
  }
}


export default function ServiceScreen({ config }: { config: ServiceConfig }) {
  const [loc, setLoc] = useState<{ label: string; lat?: number; lng?: number } | null>(null);
  const [quick, setQuick] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<string>("BEST_MATCH");
  const [model, setModel] = useState("");
  const [acres, setAcres] = useState("");
  const [rentalMode, setRentalMode] = useState("");
  const [seats, setSeats] = useState("");
  const [ac, setAc] = useState<"" | "true" | "false">("");

  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ambiguous, setAmbiguous] = useState<{ id: string; label: string; lat: number; lng: number }[] | null>(null);
  const [radiusBoost, setRadiusBoost] = useState(0);

  const [booking, setBooking] = useState<ResultCard | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const didInitialSearch = useRef(false);

  const runSearch = useCallback(
    async (override?: Partial<{ locationText: string; lat: number; lng: number; radiusKm: number }>) => {
      if (!loc && !override?.lat && !override?.locationText) {
        setError("Where should I search? Pick your location above.");
        return;
      }
      setLoading(true);
      setError(null);
      setAmbiguous(null);

      const p = new URLSearchParams();
      p.set("type", config.searchType);
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
      const radius = override?.radiusKm ?? (radiusBoost || null);
      if (radius) p.set("radiusKm", String(radius));
      for (const [k, v] of Object.entries(quick)) if (v) p.set(k, v);
      if (model.trim()) p.set("model", model.trim());
      if (config.acresField && acres) p.set("acres", acres);
      if (rentalMode) p.set("rentalMode", rentalMode);
      if (seats) p.set("seats", seats);
      if (ac) p.set("ac", ac);

      const r = await api<{ result: SearchResult }>(`/api/search?${p.toString()}`);
      setLoading(false);
      if (r.status === 300 && r.data.options) {
        setAmbiguous(r.data.options);
        setResult(null);
        return;
      }
      if (r.status === 422) {
        setError(r.data.message || r.data.error || "Tell me where to search.");
        setResult(null);
        return;
      }
      if (!r.ok) {
        setError(r.data.error || "Search failed. Please try again.");
        setResult(null);
        return;
      }
      setResult(r.data.result);
    },
    [loc, quick, sort, model, acres, rentalMode, seats, ac, radiusBoost, config.searchType]
  );

  useEffect(() => {
    if (!didInitialSearch.current && loc) {
      didInitialSearch.current = true;
      runSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc]);

  // auto re-search when sort changes after initial results
  useEffect(() => {
    if (didInitialSearch.current && result && !loading) {
      runSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  // Handoff from hero SearchPanel / landing CTAs:
  // ?locationText=&lat=&lng=&category=&rentalMode=
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (![...q.keys()].length) return;
    didInitialSearch.current = true;
    const lt = q.get("locationText");
    const lat = parseFloat(q.get("lat") || "");
    const lng = parseFloat(q.get("lng") || "");
    if (q.get("rentalMode")) setRentalMode(q.get("rentalMode")!);
    if (q.get("category")) setQuick((prev) => ({ ...prev, category: q.get("category")! }));
    runSearch({
      locationText: lt || undefined,
      lat: lat && lng ? lat : undefined,
      lng: lat && lng ? lng : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleQuick(f: QuickFilter) {
    setQuick((prev) => {
      const active = Object.keys(prev).length > 0 && JSON.stringify(prev) === JSON.stringify(f.params);
      return active ? {} : f.params;
    });
  }

  const compareCards = useMemo(
    () => (result?.items || []).filter((c) => compareIds.includes(c.id)).slice(0, 4),
    [result, compareIds]
  );

  return (
    <div className="pb-24">
      {/* cinematic page hero */}
      <section className="relative overflow-hidden bg-ink text-white">
        <img src={heroImage(config.searchType)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
        <div className={`absolute inset-0 bg-gradient-to-t ${heroTint(config.searchType)}`} />
        <div className="container-nw relative pb-16 pt-8 sm:pb-24 sm:pt-14">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-400 sm:text-xs sm:tracking-[0.28em]">
            {config.eyebrow}
          </p>
          <h1 className="mt-2 max-w-2xl font-display text-[26px] font-extrabold leading-[1.15] tracking-tight sm:mt-3 sm:text-4xl md:text-5xl">
            {config.title}
          </h1>
          <p className="mt-2.5 max-w-xl text-[13px] leading-relaxed text-white/70 sm:mt-3 sm:text-base">
            {config.subtitle}
          </p>
        </div>
      </section>

      <div className="container-nw relative z-10 -mt-10 sm:-mt-14">
        {/* search controls — sticky on mobile for thumb reach */}
        <div className="card sticky top-[72px] z-20 space-y-4 p-4 shadow-lift sm:static sm:p-5" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <LocationPicker value={loc?.label} onPick={setLoc} />
            <button
              className="btn-primary !py-3"
              onClick={() => {
                setRadiusBoost(0);
                runSearch();
              }}
              disabled={loading}
            >
              {loading ? "Searching…" : <><Search className="h-4 w-4" /> Search</>}
            </button>
          </div>

          {/* quick filters */}
          {config.quickFilters && (
            <div className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
              {config.quickFilters.map((f) => {
                const active = JSON.stringify(quick) === JSON.stringify(f.params);
                return (
                  <button
                    key={f.label}
                    onClick={() => toggleQuick(f)}
                    aria-pressed={active}
                    className={`inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                      active
                        ? "border-brand-500 bg-brand-500 text-white shadow-sm"
                        : "border-ink/15 bg-white text-ink-mute hover:border-brand-400 hover:text-brand-700"
                    }`}
                  >
                    {(() => {
                      const I = ICONS[f.icon as keyof typeof ICONS];
                      return I ? <I className="h-4 w-4" /> : null;
                    })()}
                    {f.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* related verticals (e.g. spraying drones inside farm) */}
          {config.relatedLinks && (
            <div className="flex flex-wrap items-center gap-2 border-t border-ink/[0.06] pt-3">
              {config.relatedLinks.map((l) => {
                const I = ICONS[l.icon];
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3.5 py-1.5 text-xs font-semibold text-ink-mute transition hover:bg-brand-50 hover:text-brand-700"
                  >
                    {I && <I className="h-3.5 w-3.5" />} {l.label} →
                  </Link>
                );
              })}
            </div>
          )}

          {(config.vehicleFilters || config.acresField || config.askModel) && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {config.askModel && (
                <input
                  className="input"
                  placeholder="Model e.g. Innova"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  aria-label="Vehicle model"
                />
              )}
              {config.acresField && (
                <input
                  className="input"
                  type="number"
                  min={0.5}
                  placeholder="Acres"
                  value={acres}
                  onChange={(e) => setAcres(e.target.value)}
                  aria-label="Acres"
                />
              )}
              {config.vehicleFilters && (
                <>
                  <select className="input" value={rentalMode} onChange={(e) => setRentalMode(e.target.value)} aria-label="Rental mode">
                    <option value="">Any mode</option>
                    <option value="SELF_DRIVE">Self-drive</option>
                    <option value="WITH_DRIVER">With driver</option>
                  </select>
                  <select className="input" value={seats} onChange={(e) => setSeats(e.target.value)} aria-label="Minimum seats">
                    <option value="">Any seats</option>
                    {[4, 5, 6, 7, 12].map((s) => (
                      <option key={s} value={s}>{s}+ seats</option>
                    ))}
                  </select>
                  <select className="input" value={ac} onChange={(e) => setAc(e.target.value as any)} aria-label="AC preference">
                    <option value="">AC or not — either fine</option>
                    <option value="true">AC only</option>
                    <option value="false">Non-AC</option>
                  </select>
                </>
              )}
            </div>
          )}
        </div>

        {/* ambiguous location resolution */}
        {ambiguous && (
          <div className="card mt-4 border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              I found more than one place with that name. Which one do you mean?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ambiguous.map((o) => (
                <button
                  key={o.id}
                  className="btn-outline !py-2"
                  onClick={() => {
                    setAmbiguous(null);
                    runSearch({ lat: o.lat, lng: o.lng, locationText: o.label });
                  }}
                >
                  <MapPin className="h-4 w-4 text-brand-500" /> {o.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* error / guidance */}
        {error && (
          <p className="card mt-4 border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</p>
        )}

        {/* results */}
        {loading && (
          <div className="mt-6 space-y-4" aria-busy="true" aria-label="Loading results">
            <LoadingSteps />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        )}

        {!loading && result && (
          <section className="mt-7">
            <header className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold tracking-tight sm:text-xl">
                  {result.items.length > 0
                    ? `Found ${result.items.length} option${result.items.length > 1 ? "s" : ""} near ${shortLabel(loc?.label)}`
                    : `No exact match right now`}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Searched within ~{result.searchedRadiusKm} km
                  {result.showingAlternatives ? " · showing nearby alternatives" : ""}
                </p>
              </div>
              <div className="hide-scrollbar flex gap-1 overflow-x-auto rounded-full bg-paper-deep p-1">
                {SORTS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSort(s.id)}
                    aria-pressed={sort === s.id}
                    className={`min-h-[44px] whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition ${
                      sort === s.id ? "bg-ink text-white shadow-sm" : "text-ink-mute hover:text-ink"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </header>

            {result.showingAlternatives && (
              <p className="mt-3 rounded-xl bg-sky-50 px-3.5 py-2.5 text-sm text-sky-900">
                I couldn&apos;t find that exact one nearby — these are the closest available alternatives.
              </p>
            )}

            {result.items.length === 0 ? (
              <EmptyState
                img={emptyImage(config.searchType)}
                onExpand={() => {
                  setRadiusBoost(45);
                  setTimeout(() => runSearch(), 0);
                }}
                onClear={() => {
                  setQuick({});
                  setModel("");
                  setRadiusBoost(0);
                  setTimeout(() => runSearch(), 0);
                }}
              />
            ) : (
              <motion.div
                className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.04 } },
                }}
              >
                {result.items.map((c, i) => (
                  <motion.div
                    key={c.id}
                    variants={{
                      hidden: { opacity: 0, y: 12 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
                    }}
                    whileHover={{ y: -2, transition: { duration: 0.15 } }}
                    whileTap={{ scale: 0.98, transition: { duration: 0.12 } }}
                  >
                    <ResultCardView
                      card={c}
                      index={i + 1}
                      bestMatch={i === 0 && sort === "BEST_MATCH"}
                      selected={compareIds.includes(c.id)}
                      onBook={(card) => setBooking(card)}
                      onCompare={(card) =>
                        setCompareIds((ids) =>
                          ids.includes(card.id) ? ids.filter((x) => x !== card.id) : [...ids, card.id].slice(-4)
                        )
                      }
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </section>
        )}

        {!loading && !result && !ambiguous && !error && (
          <section className="card mt-10 overflow-hidden p-0 text-center">
            <img src={emptyImage(config.searchType)} alt="" className="h-44 w-full object-cover opacity-75" />
            <div className="p-8">
              <h2 className="font-display text-lg font-bold">{config.title.replace(/^.*?\?\s*/, "")} starts with a place</h2>
              <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-mute">
                Pick your village, town or current location above — Near Wheels finds real providers near you,
                with live availability and clear prices.
              </p>
            </div>
          </section>
        )}
      </div>

      {/* compare tray */}
      {compareCards.length >= 2 && !showCompare && (
        <div className="fixed inset-x-0 bottom-[88px] z-40 flex justify-center px-4 md:bottom-6">
          <button className="btn-primary min-h-[48px] shadow-lg !px-5 !py-3" onClick={() => setShowCompare(true)}>
            <Scale className="h-4 w-4" /> Compare {compareCards.length}
          </button>
        </div>
      )}
      {showCompare && compareCards.length >= 2 && (
        <ComparisonModal cards={compareCards} onClose={() => setShowCompare(false)} />
      )}

      {/* booking sheet */}
      {booking && (
        <BookingSheet
          card={booking}
          acresHint={acres ? Number(acres) : undefined}
          onClose={() => setBooking(null)}
        />
      )}
    </div>
  );
}

function shortLabel(l?: string | null): string {
  if (!l) return "you";
  return l.split(",")[0];
}function LoadingSteps() {
  const steps = ["Searching near you", "Checking availability", "Finding nearby providers", "Comparing prices"];
  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-ink-mute">
      {steps.map((s, i) => (
        <li key={s} className={`inline-flex items-center gap-1.5 ${i === 0 ? "anim-in font-semibold text-brand-700" : ""}`}>
          {i === 0 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-emerald-600" />}
          {s}
        </li>
      ))}
    </ol>
  );
}

function EmptyState({ img, onExpand, onClear }: { img: string; onExpand: () => void; onClear: () => void }) {
  return (
    <div className="card mt-4 overflow-hidden p-0 text-center">
      <img src={img} alt="" className="h-40 w-full object-cover opacity-70" />
      <div className="p-6">
        <h3 className="font-display text-lg font-bold">Nothing available in this area right now</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-mute">
          Providers go online through the day. Try a wider radius, remove filters, or check back soon.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button className="btn-primary !py-2" onClick={onExpand}>Expand search radius</button>
          <button className="btn-outline !py-2" onClick={onClear}>Clear filters & retry</button>
          <a className="btn-outline !py-2" href="/">Ask the AI assistant</a>
        </div>
      </div>
    </div>
  );
}

function ComparisonModal({ cards, onClose }: { cards: ResultCard[]; onClose: () => void }) {
  const rows: { label: string; get: (c: ResultCard) => string }[] = [
    { label: "Distance", get: (c) => (c.distanceKm != null ? `${c.distanceKm.toFixed(1)} km` : "—") },
    { label: "ETA", get: (c) => (c.etaMin != null ? `${c.etaMin} min` : "—") },
    { label: "Price", get: (c) => c.priceLabel },
  ];
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="sheet-in w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="font-bold">Side-by-side</h2>
          <button aria-label="Close comparison" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={onClose}>
            <IconX className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400"></th>
                {cards.map((c) => (
                  <th key={c.id} className="px-4 py-2.5 font-bold text-slate-800">
                    {c.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{r.label}</td>
                  {cards.map((c) => (
                    <td key={c.id} className="px-4 py-2.5 text-slate-700">{r.get(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          Best match balances what you asked for, distance, price, rating and verification.
        </p>
      </div>
    </div>
  );
}



