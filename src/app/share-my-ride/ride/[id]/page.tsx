"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  Car,
  MapPin,
  Clock,
  Star,
  ShieldCheck,
  CheckCircle,
  Users,
  MessageCircle,
  Phone,
  ArrowLeft,
  Check,
  Calendar,
} from "lucide-react";
import { inr } from "@/lib/ui";

export default function RideDetailsPage({ params }: { params: Promise<{  id: string  }> }) {
  const { id } = use(params);
  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Booking Modal State
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [seatsBooked, setSeatsBooked] = useState(1);
  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");
  const [bookingSubmitted, setBookingSubmitted] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [driverContact, setDriverContact] = useState<{ name: string; phone: string } | null>(null);

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
    return <div className="py-20 text-center text-sm font-semibold text-slate-500">Loading ride details…</div>;
  }

  if (!ride) {
    return (
      <div className="py-20 text-center">
        <h2 className="font-display text-xl font-bold text-slate-900">Ride not found</h2>
        <Link href="/share-my-ride/find" className="mt-4 inline-block btn-outline">
          Back to Find Rides
        </Link>
      </div>
    );
  }

  const stops: string[] = JSON.parse(ride.stopsJson || "[]");
  const preferences = JSON.parse(ride.preferencesJson || "{}");

  async function handleBookSeat() {
    setBookingError(null);
    if (!passengerName || !passengerPhone) {
      setBookingError("Please provide your name and valid contact phone number.");
      return;
    }

    try {
      const res = await fetch(`/api/share-rides/${ride.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passengerName,
          passengerPhone,
          seatsBooked,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setBookingError(data.error || "Failed to confirm seat booking.");
      } else {
        setBookingSubmitted(true);
        // Free launch: the seat is confirmed right away — no payment step.
        if (data.driverPhone) setDriverContact({ name: data.driverName || ride.driverName, phone: data.driverPhone });
      }
    } catch {
      setBookingError("Network error — please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 md:py-16">
      <div className="container-nw max-w-4xl">
        <Link href="/share-my-ride/find" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Search Results
        </Link>

        {/* Hero Banner */}
        <div className="rounded-3xl bg-slate-900 p-6 md:p-8 text-white shadow-xl flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">SHARED RIDE DETAILS</span>
            <h1 className="font-display text-2xl font-bold md:text-4xl mt-1">
              {ride.fromLocation} → {ride.toLocation}
            </h1>
            <p className="mt-2 text-xs text-slate-300 flex items-center gap-3">
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {ride.travelDate}</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {ride.departureTime}</span>
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md text-right border border-white/15">
            <span className="font-display text-3xl font-extrabold text-white">{inr(ride.pricePerSeat)}</span>
            <span className="text-xs text-slate-300"> / seat</span>
            <p className="text-xs font-bold text-emerald-400 mt-1">
              {ride.availableSeats} of {ride.totalSeats} seats left
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {/* Main Details (2 cols) */}
          <div className="space-y-6 md:col-span-2">
            {/* Driver Card */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">DRIVER DETAILS</h2>
              <div className="mt-4 flex items-start gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 font-extrabold text-amber-800 text-xl">
                  {ride.driverName[0]}
                </div>
                <div>
                  <h3 className="font-display font-bold text-slate-900 text-lg flex items-center gap-2">
                    {ride.driverName}
                    {ride.verified && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle className="h-3.5 w-3.5" /> Identity Verified
                      </span>
                    )}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 flex items-center gap-2">
                    <span className="flex items-center gap-1 font-bold text-slate-800">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {ride.driverRating}
                    </span>
                    <span>· {ride.driverTotalRides} rides completed</span>
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1">✓ Driving Licence Verified</span>
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1">✓ Vehicle Documents Checked</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Vehicle Details */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">VEHICLE DETAILS</h2>
              <div className="mt-4 flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                  <Car className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-slate-900 text-base">{ride.vehicleTitle}</h3>
                  <p className="text-xs text-slate-500">7 Seats · AC Equipped · Large Luggage Capacity</p>
                </div>
              </div>
            </div>

            {/* Route Stops */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">ROUTE & STOPS</h2>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 border border-slate-200 space-y-3">
                <div className="flex items-center gap-3 text-sm font-bold text-slate-900">
                  <span className="h-3 w-3 rounded-full bg-emerald-500" />
                  <span>{ride.fromLocation} (Origin)</span>
                  <span className="text-xs font-normal text-slate-500 ml-auto">{ride.departureTime}</span>
                </div>

                {stops.map((st, i) => (
                  <div key={i} className="ml-1.5 border-l-2 border-dashed border-slate-300 pl-6 py-1 text-xs font-semibold text-slate-600">
                    ● Intermediate stop: {st}
                  </div>
                ))}

                <div className="flex items-center gap-3 text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                  <span className="h-3 w-3 rounded-full bg-amber-500" />
                  <span>{ride.toLocation} (Destination)</span>
                </div>
              </div>
            </div>

            {/* Ride Preferences */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">RIDE PREFERENCES</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-semibold text-slate-700">
                <span className="rounded-xl bg-slate-50 p-3">Smoking: {preferences.smoking ? "Allowed" : "No Smoking"}</span>
                <span className="rounded-xl bg-slate-50 p-3">Pets: {preferences.pets ? "Pets Allowed" : "No Pets"}</span>
                <span className="rounded-xl bg-slate-50 p-3">Luggage: {preferences.luggage || "Medium"}</span>
                <span className="rounded-xl bg-slate-50 p-3">Music: {preferences.music ? "Okay" : "Quiet"}</span>
              </div>
            </div>
          </div>

          {/* Right Action Sidebar (1 col) */}
          <div>
            <div className="sticky top-24 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">PRICE & SEATS</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-display text-3xl font-extrabold text-slate-900">{inr(ride.pricePerSeat)}</span>
                  <span className="text-xs font-bold text-emerald-600">{ride.availableSeats} available</span>
                </div>
              </div>

              {ride.availableSeats > 0 ? (
                <button
                  onClick={() => setShowBookingModal(true)}
                  className="btn-primary w-full !py-3 text-base flex items-center justify-center gap-2"
                >
                  REQUEST TO JOIN
                </button>
              ) : (
                <div className="rounded-2xl bg-amber-50 p-3 text-center text-xs font-bold text-amber-700">
                  Ride is fully booked!
                </div>
              )}

              <div className="border-t border-slate-100 pt-4 text-xs text-slate-500 space-y-2">
                <p>✓ Instant seat confirmation</p>
                <p>✓ Direct contact details shared after booking</p>
                <p>✓ 100% money-back safety guarantee</p>
              </div>
            </div>
          </div>
        </div>

        {/* BOOKING SEAT MODAL */}
        {showBookingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
              {!bookingSubmitted ? (
                <>
                  <h3 className="font-display text-xl font-bold text-slate-900">SELECT SEATS & DETAILS</h3>
                  <p className="text-xs text-slate-500">
                    {ride.fromLocation} → {ride.toLocation} ({ride.travelDate})
                  </p>

                  <div>
                    <label className="label">Number of Seats</label>
                    <div className="flex items-center gap-3">
                      {[1, 2, 3, 4].map((n) => (
                        <button
                          key={n}
                          type="button"
                          disabled={n > ride.availableSeats}
                          onClick={() => setSeatsBooked(n)}
                          className={`h-10 w-10 rounded-xl text-sm font-bold ${
                            seatsBooked === n
                              ? "bg-amber-500 text-slate-950 shadow-sm"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="label">Passenger Full Name</label>
                    <input
                      type="text"
                      value={passengerName}
                      onChange={(e) => setPassengerName(e.target.value)}
                      placeholder="e.g. Rahul Kumar"
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="label">Mobile Number</label>
                    <input
                      type="tel"
                      value={passengerPhone}
                      onChange={(e) => setPassengerPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="input"
                    />
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 flex justify-between font-bold text-slate-900 text-sm">
                    <span>Total Amount:</span>
                    <span>{inr(seatsBooked * ride.pricePerSeat)}</span>
                  </div>

                  {bookingError && <p className="text-xs text-red-600 font-semibold">{bookingError}</p>}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowBookingModal(false)}
                      className="btn-outline flex-1 !py-2.5"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBookSeat}
                      className="btn-primary flex-1 !py-2.5"
                    >
                      CONFIRM & BOOK
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-4 space-y-4">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                    <Check className="h-7 w-7" />
                  </span>
                  <h3 className="font-display text-xl font-bold text-slate-900">Seat Booking Confirmed!</h3>
                  <p className="text-xs text-slate-600">
                    Your {seatsBooked} seat(s) on <strong>{ride.driverName}</strong>'s ride have been reserved. No payment needed.
                  </p>
                  {driverContact && (
                    <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left">
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Driver contact revealed</p>
                      <p className="mt-1 text-sm font-bold text-emerald-900">{driverContact.name}</p>
                      <a href={`tel:${driverContact.phone}`} className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-amber-700 hover:underline">
                        📞 {driverContact.phone} — Call driver
                      </a>
                    </div>
                  )}
                  <div className="pt-2 flex flex-col gap-2">
                    <Link href={`/share-my-ride/live/${ride.id}`} className="btn-primary !py-2.5">TRACK LIVE TRIP</Link>
                    <Link href="/share-my-ride/my-bookings" className="btn-outline !py-2.5">View My Bookings</Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
