"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  MapPin,
  Users,
  Bus,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight,
  Search,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import { inr } from "@/lib/ui";

export interface YatraTrip {
  id: string;
  packageName: string;
  pricePerHead: number;
  totalSeats: number;
  availableSeats: number;
  departureDate: string;
  operatorPhone: string;
  stops: string[];
  verified: boolean;
}

const INITIAL_TRIPS: YatraTrip[] = [
  {
    id: "yt-1",
    packageName: "Sri Venkateswara Tirupati Special Darshan Yatra",
    pricePerHead: 1499,
    totalSeats: 40,
    availableSeats: 4,
    departureDate: "2026-08-30",
    operatorPhone: "9876543210",
    stops: [
      "Hyderabad Boarding (MGBS)",
      "Tirupati Balaji Main Temple",
      "Padmavathi Temple (Tiruchanur)",
      "Srikalahasti Rahu-Ketu Kshetram",
      "Kanipakam Varasiddhi Vinayaka",
      "Kapila Theertham Waterfalls",
    ],
    verified: true,
  },
  {
    id: "yt-2",
    packageName: "Bhadrachalam Rama Temple & Godavari River Tour",
    pricePerHead: 999,
    totalSeats: 35,
    availableSeats: 0,
    departureDate: "2026-08-29",
    operatorPhone: "9812345678",
    stops: [
      "Vijayawada Pickup",
      "Bhadrachalam Seetha Ramachandra Swamy",
      "Parnasala Holy Site",
      "Godavari River Ghat",
    ],
    verified: true,
  },
  {
    id: "yt-3",
    packageName: "Srisailam Mallikarjuna Jyotirlinga weekend Yatra",
    pricePerHead: 1250,
    totalSeats: 45,
    availableSeats: 18,
    departureDate: "2026-09-05",
    operatorPhone: "9988776655",
    stops: [
      "Kurnool Junction",
      "Srisailam Mallikarjuna Swamy Temple",
      "Bhramaramba Devi Shakti Peetham",
      "Sakshi Ganapati Temple",
      "Pathala Ganga Ropeway",
    ],
    verified: true,
  },
];

export default function YatraBusPortal() {
  const [currentSystemDate, setCurrentSystemDate] = useState("2026-08-27");
  const [trips, setTrips] = useState<YatraTrip[]>(INITIAL_TRIPS);
  const [showDemo, setShowDemo] = useState(false);
  const [filter, setFilter] = useState<"all" | "available" | "verified">("all");

  useEffect(() => {
    fetch("/api/yatra-buses")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok || !Array.isArray(data.packages) || data.packages.length === 0) return;
        setTrips(
          data.packages.map((pkg: any) => ({
            id: pkg.id,
            packageName: pkg.packageName,
            pricePerHead: pkg.pricePerHead,
            totalSeats: pkg.totalSeats,
            availableSeats: pkg.availableSeats,
            departureDate: pkg.departureDate,
            operatorPhone: "",
            stops: pkg.stops.map((s: { name: string }) => s.name),
            verified: pkg.operator?.verified === true,
          }))
        );
      })
      .catch(() => undefined);
  }, []);

  function handleBookSeat(tripId: string) {
    setTrips((prev) => prev.map((t) => (t.id === tripId && t.availableSeats > 0 ? { ...t, availableSeats: t.availableSeats - 1 } : t)));
  }

  const visibleTrips = trips.filter((t) => t.departureDate >= currentSystemDate);
  const filteredTrips = visibleTrips.filter((t) => {
    if (filter === "available") return t.availableSeats > 0;
    if (filter === "verified") return t.verified;
    return true;
  });
  const expiredCount = trips.length - visibleTrips.length;

  return (
    <div className="space-y-6">
      {/* Hero — brand ink + amber, premium */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-[2rem] bg-ink text-white shadow-lift"
      >
        <img
          src="https://images.unsplash.com/photo-1544550581-5f7ceaf7f992?w=1200&h=600&fit=crop&q=80"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
        <div className="relative p-6 sm:p-8 md:p-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-amber-300 ring-1 ring-white/15 backdrop-blur">
            <Bus className="h-3.5 w-3.5" /> Temple Yatra • Verified buses
          </span>
          <h1 className="mt-3 max-w-2xl font-display text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-4xl md:text-5xl">
            Sacred journeys, <span className="text-brand-400">comfortable</span> buses.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
            Fixed departures, temple-wise stops, per-head pricing and live seat counts — book your darshan without calls.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/80 ring-1 ring-white/10"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Verified operators</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/80 ring-1 ring-white/10"><Calendar className="h-3.5 w-3.5" /> Fixed dates</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/80 ring-1 ring-white/10"><Users className="h-3.5 w-3.5" /> Live seats</span>
          </div>
        </div>
      </motion.div>

      {/* Controls — sticky on mobile, premium */}
      <div className="card sticky top-[72px] z-20 flex flex-col gap-3 p-4 shadow-lift sm:static sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white">
            <Sparkles className="h-3.5 w-3.5 text-brand-400" /> {filteredTrips.length} packages • from {currentSystemDate}
          </span>
          {expiredCount > 0 && <span className="text-xs font-medium text-amber-700">{expiredCount} expired hidden</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-paper-deep p-1">
            {(["all", "available", "verified"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${filter === f ? "bg-ink text-white shadow" : "text-ink-mute hover:text-ink"}`}
              >
                {f === "all" ? "All" : f === "available" ? "Available" : "Verified"}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowDemo(!showDemo)}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs font-semibold text-ink-mute hover:border-brand-400"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Demo
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showDemo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="card border-amber-200 bg-amber-50/70 p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-800"><Clock className="h-3.5 w-3.5" /> Demo — travel in time to test auto-cleanup</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { label: "Today (27 Aug)", date: "2026-08-27" },
                  { label: "30 Aug", date: "2026-08-30" },
                  { label: "31 Aug", date: "2026-08-31" },
                  { label: "06 Sep", date: "2026-09-06" },
                ].map((d) => (
                  <button
                    key={d.date}
                    onClick={() => setCurrentSystemDate(d.date)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${currentSystemDate === d.date ? "bg-ink text-white" : "bg-white text-ink-mute hover:bg-ink hover:text-white"}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      {filteredTrips.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-10 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-paper"><Search className="h-6 w-6 text-ink-faint" /></div>
          <h3 className="mt-3 font-bold">No packages for this filter</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-mute">Try All or Verified, or check back — new yatras are added weekly.</p>
        </motion.div>
      ) : (
        <motion.div
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
        >
          {filteredTrips.map((trip) => {
            const isHouseful = trip.availableSeats === 0;
            const pctLeft = Math.round((trip.availableSeats / trip.totalSeats) * 100);
            return (
              <motion.article
                key={trip.id}
                variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } } }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-card transition hover:shadow-lift ${isHouseful ? "border-red-200 opacity-90" : "border-ink/10 hover:border-brand-200"}`}
              >
                {isHouseful && (
                  <div className="absolute -right-10 top-6 z-10 rotate-45 bg-red-600 px-10 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-md">Houseful</div>
                )}
                <div className="relative h-36 bg-gradient-to-br from-ink via-ink-soft to-brand-900/30 p-4">
                  <img src="https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&h=300&fit=crop&q=80" alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />
                  <div className="relative flex items-start justify-between">
                    <span className="badge bg-white/90 text-ink px-2.5 py-1 text-xs backdrop-blur"><Calendar className="h-3 w-3" />{trip.departureDate}</span>
                    {trip.verified && <span className="badge bg-emerald-500 text-white px-2.5 py-1 text-xs"><ShieldCheck className="h-3 w-3" /> Verified</span>}
                  </div>
                  <h3 className="relative mt-3 line-clamp-2 font-display text-base font-bold leading-snug text-white">{trip.packageName}</h3>
                  <p className="relative mt-1 flex items-center gap-1 text-xs font-medium text-white/70"><MapPin className="h-3 w-3" />{trip.stops.length} temple stops • {trip.totalSeats} seats</p>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Per head</p>
                      <p className="font-display text-2xl font-extrabold tracking-tight text-ink">{inr(trip.pricePerHead)}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-bold ${isHouseful ? "text-red-600" : pctLeft < 20 ? "text-amber-700" : "text-emerald-700"}`}>
                        {isHouseful ? "Sold out" : `${trip.availableSeats} left`}
                      </p>
                      <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-paper-deep">
                        <div className={`h-full rounded-full transition-all ${isHouseful ? "bg-red-500" : pctLeft < 20 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.max(4, pctLeft)}%` }} />
                      </div>
                      <p className="mt-0.5 text-[11px] text-ink-faint">{trip.availableSeats}/{trip.totalSeats}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {trip.stops.slice(0, 4).map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
                        <span className="grid h-4 w-4 place-items-center rounded-full bg-amber-500 text-[10px] font-bold text-white">{i + 1}</span>
                        {s.split(" ").slice(0, 3).join(" ")}
                      </span>
                    ))}
                    {trip.stops.length > 4 && <span className="rounded-full bg-paper px-2.5 py-1 text-xs font-medium text-ink-mute">+{trip.stops.length - 4} more</span>}
                  </div>

                  <div className="mt-4 flex gap-2 border-t border-ink/5 pt-4">
                    <Link href={`/yatra-buses/${trip.id}`} className="btn-outline min-h-[44px] flex-1 !rounded-xl !py-2.5 text-sm">
                      Details
                    </Link>
                    <button
                      disabled={isHouseful}
                      onClick={() => handleBookSeat(trip.id)}
                      className={`min-h-[44px] flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.98] ${isHouseful ? "bg-paper text-ink-faint cursor-not-allowed" : "btn-primary"}`}
                    >
                      {isHouseful ? "Sold out" : <><Check className="mr-1 inline h-3.5 w-3.5" /> Book seat</>}
                    </button>
                  </div>
                  <p className="mt-2 text-center text-xs text-ink-faint">No advance needed • Free cancellation before confirmation</p>
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      )}

      <p className="text-center text-xs text-ink-faint">Showing {filteredTrips.length} of {visibleTrips.length} active packages • Departing on/after {currentSystemDate}</p>
    </div>
  );
}
