"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  MapPin,
  Clock,
  Car,
  Star,
  ShieldCheck,
  Filter,
  ArrowRight,
  Sparkles,
  CheckCircle,
} from "lucide-react";
import { inr } from "@/lib/ui";

export default function FindRidePage() {
  const [from, setFrom] = useState("Guntur");
  const [to, setTo] = useState("Bangalore");
  const [date, setDate] = useState("2026-08-30");
  const [passengers, setPassengers] = useState(1);
  const [sort, setSort] = useState<"recommended" | "cheapest" | "earliest">("recommended");

  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function searchRides() {
    setLoading(true);
    try {
      const res = await fetch(`/api/share-rides?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${date}`);
      const data = await res.json();
      setRides(data.rides || []);
    } catch {
      setRides([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    searchRides();
  }, []);

  const sortedRides = [...rides].sort((a, b) => {
    if (sort === "cheapest") return a.pricePerSeat - b.pricePerSeat;
    if (sort === "earliest") return a.departureTime.localeCompare(b.departureTime);
    return b.driverRating - a.driverRating; // recommended
  });

  return (
    <div className="min-h-screen bg-slate-50 py-10 md:py-16">
      <div className="container-nw">
        {/* Header & Search */}
        <div className="rounded-3xl bg-slate-900 p-6 md:p-8 text-white shadow-xl">
          <h1 className="font-display text-2xl font-bold md:text-3xl">FIND A RIDE</h1>
          <p className="mt-1 text-xs text-amber-400 font-medium">Search verified carpooling & rideshare trips travelling your way.</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              searchRides();
            }}
            className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Leaving From</label>
              <div className="mt-1 flex items-center rounded-xl bg-white px-3 py-2 text-slate-900">
                <MapPin className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold outline-none"
                  placeholder="Origin city"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Going To</label>
              <div className="mt-1 flex items-center rounded-xl bg-white px-3 py-2 text-slate-900">
                <MapPin className="h-4 w-4 text-amber-500 mr-2 shrink-0" />
                <input
                  type="text"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold outline-none"
                  placeholder="Destination"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Travel Date</label>
              <div className="mt-1 flex items-center rounded-xl bg-white px-3 py-2 text-slate-900">
                <Clock className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold outline-none"
                />
              </div>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="btn-primary w-full !py-2.5 flex items-center justify-center gap-2"
              >
                <Search className="h-4 w-4" /> SEARCH RIDES
              </button>
            </div>
          </form>
        </div>

        {/* Results Header & Sorting */}
        <div className="mt-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              {sortedRides.length} RIDES FOUND
            </h2>
            <p className="text-xs text-slate-500">Showing rides for {from} → {to}</p>
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-slate-200 p-1 text-xs font-bold text-slate-600">
            {(["recommended", "cheapest", "earliest"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`rounded-lg px-3 py-1.5 capitalize transition ${
                  sort === s ? "bg-white text-slate-950 shadow-sm" : "hover:text-slate-900"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Ride Cards List */}
        <div className="mt-6 grid gap-6">
          {loading ? (
            <div className="py-12 text-center text-sm font-semibold text-slate-500">Loading rides…</div>
          ) : sortedRides.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
              <Car className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 font-display text-lg font-bold text-slate-900">No matching rides found</h3>
              <p className="mt-1 text-xs text-slate-500">Try changing dates or search criteria, or offer your own ride!</p>
              <Link href="/share-my-ride/offer" className="mt-6 inline-block btn-primary !py-2.5 px-6">
                Offer a Ride
              </Link>
            </div>
          ) : (
            sortedRides.map((r) => (
              <div
                key={r.id}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-slate-300"
              >
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  {/* Left: Driver & Vehicle Info */}
                  <div className="flex items-start gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 font-extrabold text-amber-800 text-lg">
                      {r.driverName[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-bold text-slate-900 text-base">{r.driverName}</h3>
                        {r.verified && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <ShieldCheck className="h-3 w-3" /> Verified
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <Sparkles className="h-3 w-3" /> 95% Match
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-500 flex items-center gap-2">
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {r.driverRating}
                        </span>
                        <span>· {r.driverTotalRides} rides completed</span>
                        <span>· {r.vehicleTitle}</span>
                      </p>

                      {/* Route Timeline */}
                      <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span>{r.fromLocation}</span>
                        <span className="text-slate-400">({r.departureTime})</span>
                        <span className="text-slate-300">→</span>
                        {JSON.parse(r.stopsJson || "[]").map((st: string, idx: number) => (
                          <span key={idx} className="text-slate-500 text-[11px]">
                            ● {st} →
                          </span>
                        ))}
                        <span>{r.toLocation}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Price & CTA */}
                  <div className="flex flex-row items-center justify-between gap-4 border-t border-slate-100 pt-4 md:border-t-0 md:pt-0 md:flex-col md:items-end">
                    <div className="md:text-right">
                      <span className="font-display text-2xl font-extrabold text-slate-900">{inr(r.pricePerSeat)}</span>
                      <span className="text-xs text-slate-400"> / seat</span>
                      <p className="text-xs font-bold text-emerald-600 mt-0.5">
                        {r.availableSeats} of {r.totalSeats} seats left
                      </p>
                    </div>

                    <Link
                      href={`/share-my-ride/ride/${r.id}`}
                      className="btn-primary !py-2.5 px-6 text-xs font-bold flex items-center gap-1.5"
                    >
                      VIEW RIDE <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
