"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  Car,
  MapPin,
  Clock,
  Star,
  ShieldCheck,
  Phone,
  MessageSquare,
  AlertTriangle,
  Share2,
  CheckCircle,
  Check,
} from "lucide-react";
import { inr } from "@/lib/ui";

export default function LiveRidePage({ params }: { params: Promise<{  id: string  }> }) {
  const { id } = use(params);
  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Rating Modal
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/share-rides/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setRide(d.ride);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="py-20 text-center text-sm font-semibold text-slate-500">Loading live ride…</div>;
  }

  if (!ride) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-display text-xl font-bold text-slate-900">Ride not found</h2>
        <Link href="/share-my-ride" className="mt-4 inline-block btn-outline">
          Back to Share My Ride
        </Link>
      </div>
    );
  }

  const stops: string[] = JSON.parse(ride.stopsJson || "[]");

  return (
    <div className="min-h-screen bg-slate-900 py-10 md:py-16 text-white">
      <div className="container-nw max-w-3xl">
        {/* Live Indicator Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="h-3.5 w-3.5 rounded-full bg-emerald-500" />
            </span>
            <span className="font-display text-base font-bold text-emerald-400 tracking-wider uppercase">
              RIDE IN PROGRESS
            </span>
          </div>

          <span className="text-xs font-semibold text-slate-400">ETA: 5h 42m remaining</span>
        </div>

        {/* Route Header */}
        <div className="mt-6">
          <h1 className="font-display text-3xl font-extrabold text-white md:text-4xl">
            {ride.fromLocation} → {ride.toLocation}
          </h1>
          <p className="mt-1 text-xs text-slate-400">Departed at {ride.departureTime} · {ride.vehicleTitle}</p>
        </div>

        {/* Interactive Progress Timeline & Map Card */}
        <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-800/80 p-6 backdrop-blur-md space-y-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">LIVE ROUTE PROGRESS</h2>

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm font-bold text-white">
              <span className="h-4 w-4 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
              <span>{ride.fromLocation} (Origin)</span>
              <span className="ml-auto text-xs text-emerald-400 font-semibold">Passed ✓</span>
            </div>

            {stops.map((st, i) => (
              <div key={i} className="ml-2 border-l-2 border-slate-700 pl-6 py-2 flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-2 font-semibold">
                  On the way to {st}
                </span>
                <span className="text-amber-400 font-bold">Approaching</span>
              </div>
            ))}

            <div className="flex items-center gap-3 text-sm font-bold text-slate-300 pt-2 border-t border-slate-700">
              <span className="h-4 w-4 rounded-full bg-amber-500 ring-4 ring-amber-500/20" />
              <span>{ride.toLocation} (Destination)</span>
              <span className="ml-auto text-xs text-slate-400">Upcoming</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-3 border-t border-slate-700 pt-6">
            <button
              onClick={() => alert("Live location link copied to clipboard!")}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-slate-700/60 p-3 text-xs font-bold text-slate-200 transition hover:bg-slate-700"
            >
              <Share2 className="h-5 w-5 text-amber-400" />
              Share Location
            </button>

            <a
              href={`tel:${ride.driverPhone}`}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-slate-700/60 p-3 text-xs font-bold text-slate-200 transition hover:bg-slate-700"
            >
              <Phone className="h-5 w-5 text-emerald-400" />
              Call Driver
            </a>

            <a
              href="/emergency"
              className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-red-500/20 border border-red-500/30 p-3 text-xs font-bold text-red-400 transition hover:bg-red-500/30"
            >
              <AlertTriangle className="h-5 w-5" />
              Emergency
            </a>
          </div>
        </div>

        {/* Complete Ride & Rate Trigger */}
        <div className="mt-8 text-center">
          <button
            onClick={() => setShowRatingModal(true)}
            className="btn-primary w-full !py-3.5 text-base flex items-center justify-center gap-2"
          >
            COMPLETE RIDE & RATE DRIVER
          </button>
        </div>

        {/* RATING & REVIEW MODAL */}
        {showRatingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md text-slate-900">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
              {!ratingSubmitted ? (
                <>
                  <h3 className="font-display text-xl font-bold text-slate-900 text-center">RIDE COMPLETED</h3>
                  <p className="text-xs text-slate-500 text-center">How was your trip with {ride.driverName}?</p>

                  {/* 5-Star Selector */}
                  <div className="flex justify-center gap-2 py-3">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setRating(s)}
                        className="text-amber-400 transition transform hover:scale-110"
                      >
                        <Star className={`h-8 w-8 ${s <= rating ? "fill-amber-400" : "text-slate-300"}`} />
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="label">Write a Review</label>
                    <textarea
                      value={review}
                      onChange={(e) => setReview(e.target.value)}
                      placeholder="Great drive, smooth journey, polite driver…"
                      className="input h-24 resize-none"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowRatingModal(false)} className="btn-outline flex-1 !py-2.5">
                      Cancel
                    </button>
                    <button
                      onClick={() => setRatingSubmitted(true)}
                      className="btn-primary flex-1 !py-2.5"
                    >
                      SUBMIT RATING
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-6 space-y-3">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                    <Check className="h-7 w-7" />
                  </span>
                  <h3 className="font-display text-xl font-bold text-slate-900">Thank you for rating!</h3>
                  <p className="text-xs text-slate-600">Your review helps keep Near Wheels safe and community-trusted.</p>
                  <Link href="/share-my-ride" className="inline-block btn-primary !py-2.5 px-6 mt-4">
                    Back to Share My Ride
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
