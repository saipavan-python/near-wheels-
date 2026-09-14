"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Car, Clock, ShieldCheck, CheckCircle } from "lucide-react";
import { inr } from "@/lib/ui";

export default function MyBookingsPage() {
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/share-rides")
      .then((r) => r.json())
      .then((d) => {
        setRides(d.rides || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 py-10 md:py-16">
      <div className="container-nw max-w-4xl">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 md:text-3xl">MY BOOKINGS</h1>
          <p className="text-xs text-slate-500">Passenger Dashboard — View your booked shared rides</p>
        </div>

        <div className="mt-8 space-y-6">
          {loading ? (
            <div className="py-12 text-center text-sm font-semibold text-slate-500">Loading bookings…</div>
          ) : rides.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
              <Car className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 font-display text-lg font-bold text-slate-900">No bookings found</h3>
              <Link href="/share-my-ride/find" className="mt-4 inline-block btn-primary !py-2.5 px-6">
                Find a Ride
              </Link>
            </div>
          ) : (
            rides.slice(0, 2).map((r) => (
              <div key={r.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">BOOKED & CONFIRMED</span>
                    <h3 className="font-display text-xl font-bold text-slate-900 mt-1">
                      {r.fromLocation} → {r.toLocation}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {r.travelDate} at {r.departureTime} · Driver: <strong>{r.driverName}</strong> {r.driverRating}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="font-display text-xl font-extrabold text-slate-900">{inr(r.pricePerSeat)}</span>
                    <span className="block text-xs text-slate-400">1 seat reserved</span>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4 flex gap-3">
                  <Link href={`/share-my-ride/live/${r.id}`} className="btn-primary flex-1 !py-2 text-center text-xs">
                    TRACK LIVE TRIP
                  </Link>
                  <Link href={`/share-my-ride/ride/${r.id}`} className="btn-outline flex-1 !py-2 text-center text-xs">
                    View Ride Details
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
