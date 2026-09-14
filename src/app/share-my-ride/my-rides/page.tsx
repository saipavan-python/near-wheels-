"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Car, Plus, Clock, Users, ArrowRight, ShieldCheck, Check, X } from "lucide-react";
import { inr } from "@/lib/ui";

export default function MyRidesPage() {
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 md:text-3xl">MY OFFERED RIDES</h1>
            <p className="text-xs text-slate-500">Driver Dashboard — Manage your offered trips & passenger requests</p>
          </div>
          <Link href="/share-my-ride/offer" className="btn-primary flex items-center gap-1.5 !py-2.5">
            <Plus className="h-4 w-4" /> OFFER NEW RIDE
          </Link>
        </div>

        <div className="mt-8 space-y-6">
          {loading ? (
            <div className="py-12 text-center text-sm font-semibold text-slate-500">Loading your rides…</div>
          ) : rides.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
              <Car className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 font-display text-lg font-bold text-slate-900">No offered rides yet</h3>
              <p className="mt-1 text-xs text-slate-500">Offer your first ride to start sharing costs!</p>
            </div>
          ) : (
            rides.map((r) => {
              const bookedSeatsCount = r.totalSeats - r.availableSeats;
              const sharedContribution = bookedSeatsCount * r.pricePerSeat;

              return (
                <div key={r.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">{r.travelDate} · {r.departureTime}</span>
                      <h3 className="font-display text-xl font-bold text-slate-900 mt-1">
                        {r.fromLocation} → {r.toLocation}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">{r.vehicleTitle} · {inr(r.pricePerSeat)} / seat</p>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="font-display text-lg font-bold text-emerald-600">{inr(sharedContribution)}</span>
                      <span className="block text-xs text-slate-400">shared contribution</span>
                      <span className="inline-block mt-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                        {bookedSeatsCount} / {r.totalSeats} seats booked
                      </span>
                    </div>
                  </div>

                  {/* Bookings & Requests */}
                  {r.bookings && r.bookings.length > 0 && (
                    <div className="mt-4 border-t border-slate-100 pt-4 space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">PASSENGER REQUESTS</h4>
                      {r.bookings.map((b: any) => (
                        <div key={b.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs">
                          <div>
                            <span className="font-bold text-slate-900">{b.passengerName}</span>
                            <span className="text-slate-500 ml-2">({b.passengerPhone})</span>
                            <span className="ml-2 font-semibold text-emerald-700">· {b.seatsBooked} seat(s)</span>
                          </div>
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">
                            {b.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 border-t border-slate-100 pt-4 flex gap-3">
                    <Link href={`/share-my-ride/live/${r.id}`} className="btn-primary flex-1 !py-2 text-center text-xs">
                      TRACK LIVE TRIP
                    </Link>
                    <Link href={`/share-my-ride/ride/${r.id}`} className="btn-outline flex-1 !py-2 text-center text-xs">
                      View Ride Listing
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
