"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Car,
  MapPin,
  Clock,
  Plus,
  Trash2,
  Check,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  Sparkles,
  Users,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { inr } from "@/lib/ui";

export default function OfferRideWizard() {
  const [step, setStep] = useState(1);

  // Step 1: Journey
  const [fromLocation, setFromLocation] = useState("Guntur");
  const [toLocation, setToLocation] = useState("Bangalore");
  const [travelDate, setTravelDate] = useState("2026-08-30");
  const [departureTime, setDepartureTime] = useState("06:30 PM");

  // Step 2: Route & Stops
  const [stops, setStops] = useState<string[]>(["Vijayawada", "Nellore", "Chennai"]);
  const [newStop, setNewStop] = useState("");

  // Step 3: Vehicle Selection
  const [selectedVehicle, setSelectedVehicle] = useState({
    title: "Maruti Suzuki Ertiga",
    seats: 7,
    fuel: "Petrol",
    verified: true,
  });

  // Step 4: Available Seats
  const [availableSeats, setAvailableSeats] = useState(4);

  // Step 5: Set Contribution
  const [fuelCost, setFuelCost] = useState(1800);
  const [tollCost, setTollCost] = useState(650);
  const [otherCost, setOtherCost] = useState(150);
  const [pricePerSeat, setPricePerSeat] = useState(500);

  // Step 6: Ride Preferences
  const [preferences, setPreferences] = useState({
    smoking: false,
    pets: true,
    luggage: "Medium",
    music: true,
    conversation: "Friendly",
    womenOnly: false,
    autoConfirm: true,
  });

  // Publishing state
  const [publishing, setPublishing] = useState(false);
  const [publishedRideId, setPublishedRideId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addStop() {
    if (newStop.trim()) {
      setStops([...stops, newStop.trim()]);
      setNewStop("");
    }
  }

  function removeStop(idx: number) {
    setStops(stops.filter((_, i) => i !== idx));
  }

  const estimatedTotal = fuelCost + tollCost + otherCost;
  const suggestedContribution = Math.round(estimatedTotal / (availableSeats + 1));

  async function handlePublish() {
    setError(null);
    setPublishing(true);
    try {
      const res = await fetch("/api/share-rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromLocation,
          toLocation,
          travelDate,
          departureTime,
          vehicleTitle: selectedVehicle.title,
          totalSeats: selectedVehicle.seats,
          availableSeats,
          pricePerSeat,
          stops,
          preferences,
        }),
      });
      const data = await res.json();
      setPublishing(false);

      if (!res.ok || !data.ok) {
        setError(data.error || "Failed to publish ride. Please try again.");
      } else {
        setPublishedRideId(data.ride.id);
        setStep(7); // Published confirmation
      }
    } catch {
      setPublishing(false);
      setError("Network error — please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 md:py-16">
      <div className="container-nw max-w-3xl">
        {/* Wizard Header */}
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Share My Ride</span>
          <h1 className="mt-1 font-display text-3xl font-bold text-slate-900 md:text-4xl">OFFER A RIDE</h1>
          <p className="mt-1 text-sm text-slate-500">Your Wheels. Your Choice.</p>
        </div>

        {/* Multi-Step Progress Tracker */}
        {step <= 6 && (
          <div className="mt-8 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-xs font-bold text-slate-500 overflow-x-auto hide-scrollbar">
            {[
              "01 Journey",
              "02 Route",
              "03 Vehicle",
              "04 Seats",
              "05 Price",
              "06 Preferences",
            ].map((label, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-1.5 whitespace-nowrap ${
                  step === idx + 1 ? "text-amber-600 font-extrabold" : step > idx + 1 ? "text-emerald-600" : "text-slate-400"
                }`}
              >
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${
                    step === idx + 1
                      ? "bg-amber-500 text-slate-950 font-bold"
                      : step > idx + 1
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {step > idx + 1 ? "✓" : idx + 1}
                </span>
                <span>{label}</span>
                {idx < 5 && <span className="text-slate-300 mx-1">›</span>}
              </div>
            ))}
          </div>
        )}

        {/* STEP 1: JOURNEY */}
        {step === 1 && (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm space-y-6">
            <h2 className="font-display text-xl font-bold text-slate-900">Step 01 — Your Journey</h2>

            <div>
              <label className="label">Where are you leaving from?</label>
              <div className="flex items-center rounded-xl border border-slate-300 bg-slate-50 px-3 py-3">
                <MapPin className="h-5 w-5 text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={fromLocation}
                  onChange={(e) => setFromLocation(e.target.value)}
                  placeholder="Departure city e.g. Guntur"
                  className="w-full bg-transparent text-sm font-semibold outline-none"
                />
              </div>
            </div>

            <div>
              <label className="label">Where are you going?</label>
              <div className="flex items-center rounded-xl border border-slate-300 bg-slate-50 px-3 py-3">
                <MapPin className="h-5 w-5 text-amber-500 mr-2 shrink-0" />
                <input
                  type="text"
                  value={toLocation}
                  onChange={(e) => setToLocation(e.target.value)}
                  placeholder="Destination city e.g. Bangalore"
                  className="w-full bg-transparent text-sm font-semibold outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Travel date</label>
                <input
                  type="date"
                  value={travelDate}
                  onChange={(e) => setTravelDate(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Departure time</label>
                <input
                  type="text"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  placeholder="e.g. 06:30 PM"
                  className="input"
                />
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="btn-primary w-full !py-3 text-base flex items-center justify-center gap-2"
            >
              Continue to Route <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* STEP 2: ROUTE & STOPS */}
        {step === 2 && (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm space-y-6">
            <h2 className="font-display text-xl font-bold text-slate-900">Step 02 — YOUR ROUTE & STOPS</h2>
            <p className="text-xs text-slate-500">Adding pickup points and intermediate stops increases match score with passengers.</p>

            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <span className="h-3 w-3 rounded-full bg-emerald-500" />
                {fromLocation} (Origin)
              </div>

              {stops.map((st, i) => (
                <div key={i} className="ml-1.5 my-2 border-l-2 border-dashed border-slate-300 pl-4 py-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">● {st}</span>
                  <button onClick={() => removeStop(i)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm mt-2">
                <span className="h-3 w-3 rounded-full bg-amber-500" />
                {toLocation} (Destination)
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newStop}
                onChange={(e) => setNewStop(e.target.value)}
                placeholder="Add intermediate stop e.g. Vijayawada"
                className="input"
              />
              <button
                type="button"
                onClick={addStop}
                className="btn-outline shrink-0 flex items-center gap-1"
              >
                <Plus className="h-4 w-4" /> Add Stop
              </button>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setStep(1)} className="btn-outline flex-1 !py-3">
                <ArrowLeft className="h-4 w-4 inline mr-1" /> Back
              </button>
              <button onClick={() => setStep(3)} className="btn-primary flex-1 !py-3">
                Continue to Vehicle <ArrowRight className="h-4 w-4 inline ml-1" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SELECT VEHICLE */}
        {step === 3 && (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm space-y-6">
            <h2 className="font-display text-xl font-bold text-slate-900">Step 03 — SELECT YOUR VEHICLE</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { title: "Maruti Suzuki Ertiga", seats: 7, fuel: "Petrol", verified: true },
                { title: "Kia Carens", seats: 7, fuel: "Diesel", verified: true },
              ].map((v, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedVehicle(v)}
                  className={`cursor-pointer rounded-2xl border-2 p-5 transition ${
                    selectedVehicle.title === v.title
                      ? "border-amber-500 bg-amber-50/50 shadow-md"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Car className="h-6 w-6 text-amber-600" />
                    {v.verified && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <ShieldCheck className="h-3 w-3" /> Verified
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 font-display font-bold text-slate-900">{v.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">{v.seats} seats · {v.fuel}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <button onClick={() => setStep(2)} className="btn-outline flex-1 !py-3">
                <ArrowLeft className="h-4 w-4 inline mr-1" /> Back
              </button>
              <button onClick={() => setStep(4)} className="btn-primary flex-1 !py-3">
                Continue to Seats <ArrowRight className="h-4 w-4 inline ml-1" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: AVAILABLE SEATS */}
        {step === 4 && (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm space-y-6">
            <h2 className="font-display text-xl font-bold text-slate-900">Step 04 — AVAILABLE SEATS</h2>
            <p className="text-xs text-slate-500">How many passengers can join you on this journey?</p>

            <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">FRONT</span>
              <div className="w-24 py-2 rounded-xl bg-slate-200 text-center font-bold text-xs text-slate-700 mb-6">
                DRIVER SEAT
              </div>

              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">PASSENGER SEATS</span>
              <div className="flex flex-wrap justify-center gap-3 max-w-xs">
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setAvailableSeats(num)}
                    className={`h-12 w-12 rounded-2xl text-sm font-bold transition ${
                      availableSeats === num
                        ? "bg-amber-500 text-slate-950 shadow-md ring-4 ring-amber-100"
                        : "bg-white border border-slate-300 text-slate-700 hover:border-amber-400"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <p className="mt-6 text-sm font-bold text-slate-800">Selected: {availableSeats} Seats Available</p>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setStep(3)} className="btn-outline flex-1 !py-3">
                <ArrowLeft className="h-4 w-4 inline mr-1" /> Back
              </button>
              <button onClick={() => setStep(5)} className="btn-primary flex-1 !py-3">
                Continue to Pricing <ArrowRight className="h-4 w-4 inline ml-1" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: SET CONTRIBUTION */}
        {step === 5 && (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm space-y-6">
            <h2 className="font-display text-xl font-bold text-slate-900">Step 05 — SET YOUR CONTRIBUTION</h2>
            <p className="text-xs text-slate-500">Treat this as a cost-sharing feature for fuel & tolls.</p>

            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Fuel estimate:</span>
                <span className="font-semibold">{inr(fuelCost)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Tolls estimate:</span>
                <span className="font-semibold">{inr(tollCost)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Other expenses:</span>
                <span className="font-semibold">{inr(otherCost)}</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900">
                <span>Estimated total trip cost:</span>
                <span>{inr(estimatedTotal)}</span>
              </div>
            </div>

            <div className="rounded-2xl bg-amber-50 p-6 border border-amber-200 text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Suggested Contribution</span>
              <div className="mt-2 flex items-center justify-center gap-2">
                <span className="text-sm font-bold text-slate-600">₹</span>
                <input
                  type="number"
                  value={pricePerSeat}
                  onChange={(e) => setPricePerSeat(Number(e.target.value) || 0)}
                  className="w-32 rounded-xl border border-amber-300 bg-white px-3 py-2 text-center text-2xl font-extrabold text-slate-900 shadow-inner outline-none"
                />
                <span className="text-sm font-bold text-slate-600">/ passenger</span>
              </div>
              <p className="mt-2 text-xs text-amber-700">
                Estimated shared contribution from {availableSeats} passengers: <strong className="font-bold">{inr(pricePerSeat * availableSeats)}</strong>
              </p>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setStep(4)} className="btn-outline flex-1 !py-3">
                <ArrowLeft className="h-4 w-4 inline mr-1" /> Back
              </button>
              <button onClick={() => setStep(6)} className="btn-primary flex-1 !py-3">
                Continue to Preferences <ArrowRight className="h-4 w-4 inline ml-1" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: RIDE PREFERENCES & REVIEW */}
        {step === 6 && (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm space-y-6">
            <h2 className="font-display text-xl font-bold text-slate-900">Step 06 — PREFERENCES & REVIEW</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: "Pets Allowed", key: "pets" },
                { label: "Music Allowed", key: "music" },
                { label: "Women-only Ride", key: "womenOnly" },
                { label: "Auto-confirm Booking", key: "autoConfirm" },
              ].map((item, idx) => (
                <label key={idx} className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5 cursor-pointer hover:bg-slate-50">
                  <span className="text-xs font-bold text-slate-700">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={(preferences as any)[item.key]}
                    onChange={(e) => setPreferences({ ...preferences, [item.key]: e.target.checked })}
                    className="h-4 w-4 accent-amber-500"
                  />
                </label>
              ))}
            </div>

            {/* Ride Summary Preview */}
            <div className="rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">REVIEW YOUR RIDE</span>
                <span className="text-xs text-slate-400">{travelDate} · {departureTime}</span>
              </div>
              <h3 className="text-xl font-bold">{fromLocation} → {toLocation}</h3>
              <p className="text-xs text-slate-300">{selectedVehicle.title} · {availableSeats} seats available · {inr(pricePerSeat)} / seat</p>
              {stops.length > 0 && <p className="text-xs text-slate-400">Stops: {fromLocation} → {stops.join(" → ")} → {toLocation}</p>}
            </div>

            {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}

            <div className="flex gap-4">
              <button onClick={() => setStep(5)} className="btn-outline flex-1 !py-3">
                <ArrowLeft className="h-4 w-4 inline mr-1" /> Back
              </button>
              <button
                disabled={publishing}
                onClick={handlePublish}
                className="btn-primary flex-1 !py-3 text-base flex items-center justify-center gap-2"
              >
                {publishing ? "Publishing…" : "PUBLISH RIDE"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 7: PUBLISHED CONFIRMATION */}
        {step === 7 && (
          <div className="mt-8 rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-lg space-y-4">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="h-8 w-8" />
            </span>
            <h2 className="font-display text-2xl font-bold text-slate-900">Your ride is live!</h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              <strong>{fromLocation} → {toLocation}</strong> for {travelDate} at {departureTime}. Passengers can now request your available seats!
            </p>

            <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3">
              <Link
                href={`/share-my-ride/ride/${publishedRideId}`}
                className="btn-primary !py-3 px-6"
              >
                VIEW RIDE
              </Link>
              <Link
                href="/share-my-ride/my-rides"
                className="btn-outline !py-3 px-6"
              >
                MANAGE MY RIDES
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
