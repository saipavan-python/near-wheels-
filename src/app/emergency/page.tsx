"use client";

import { useEffect, useState } from "react";
import type { ResultCard, SearchResult } from "@/lib/ui";
import { api, getCurrentPosition } from "@/lib/ui";

import LocationPicker from "@/components/LocationPicker";
import ResultCardView from "@/components/ResultCardView";
import BookingSheet from "@/components/BookingSheet";
import { IconSiren } from "@/components/icons";

import {
  Wrench,
  Truck,
  BatteryCharging,
  CircleDot,
  Loader2,
  MapPin,
  Phone,
  AlertTriangle,
} from "lucide-react";

const HELP = [
  {
    label: "Mechanic",
    icon: Wrench,
    serviceTypes: "MECHANIC,BREAKDOWN",
  },
  {
    label: "Towing",
    icon: Truck,
    serviceTypes: "TOWING",
  },
  {
    label: "Battery",
    icon: BatteryCharging,
    serviceTypes: "BATTERY",
  },
  {
    label: "Tyre",
    icon: CircleDot,
    serviceTypes: "TYRE",
  },
] as const;

type LocationState = {
  label: string;
  lat?: number;
  lng?: number;
};

export default function EmergencyClient() {
  const [loc, setLoc] = useState<LocationState | null>(null);

  const [service, setService] =
    useState<(typeof HELP)[number] | null>(null);

  const [items, setItems] = useState<ResultCard[]>([]);

  const [summary, setSummary] =
    useState<SearchResult | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [booking, setBooking] =
    useState<ResultCard | null>(null);

  const [gettingLocation, setGettingLocation] =
    useState(true);

  /*
   * Get current GPS location when the page loads.
   */
  useEffect(() => {
    let active = true;

    setGettingLocation(true);

    getCurrentPosition()
      .then((position) => {
        if (!active) return;

        setLoc({
          label: "My location",
          lat: position.lat,
          lng: position.lng,
        });

        setGettingLocation(false);
      })
      .catch((e: any) => {
        if (!active) return;

        setGettingLocation(false);
        setError(
          e?.message ||
            "Unable to detect your location. Please allow location access or choose a location manually."
        );
      });

    return () => {
      active = false;
    };
  }, []);

  /*
   * Search emergency service providers.
   */
  async function search(
    selectedService: (typeof HELP)[number]
  ) {
    setService(selectedService);
    setError(null);
    setSummary(null);
    setItems([]);

    /*
     * Location is mandatory for emergency search.
     */
    if (
      !loc ||
      typeof loc.lat !== "number" ||
      typeof loc.lng !== "number"
    ) {
      setError(
        "Turn on location or pick where you are — we need your location to find the fastest help."
      );

      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams({
        type: "garages",
        lat: String(loc.lat),
        lng: String(loc.lng),
        sortBy: "FASTEST",
        serviceTypes: selectedService.serviceTypes,
      });

      const response = await api<{ result: SearchResult }>(
        `/api/search?${params.toString()}`
      );

      if (!response.ok) {
        setError(
          response.data.message ||
          response.data.error ||
          "Couldn't search right now. Please try again."
        );

        return;
      }

      const result = response.data.result;

      setSummary(result);
      setItems(result.items || []);
    } catch (err) {
      console.error("Emergency search failed:");

      setError(
        "Something went wrong while finding emergency help. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * Reset the service search.
   */
  function resetSearch() {
    setService(null);
    setItems([]);
    setSummary(null);
    setError(null);
    setBooking(null);
  }

  /*
   * Try GPS again.
   */
  async function retryLocation() {
    setGettingLocation(true);
    setError(null);

    try {
      const position = await getCurrentPosition();

      setLoc({
        label: "My location",
        lat: position.lat,
        lng: position.lng,
      });
    } catch {
      setError(
        "Unable to get your current location. Please allow location permission or choose a location manually."
      );
    } finally {
      setGettingLocation(false);
    }
  }

  return (
    <main className="min-h-screen bg-white pb-24">
      {/* ========================================================= */}
      {/* EMERGENCY HEADER                                         */}
      {/* ========================================================= */}

      <section className="border-b-4 border-red-600 bg-gradient-to-b from-red-50 via-white to-white">
        <div className="container-nw mx-auto px-4 py-8 text-center md:py-10">
          <div className="mx-auto flex max-w-2xl flex-col items-center">
            <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-red-100 text-red-600 shadow-sm">
              <IconSiren className="h-9 w-9" />
            </div>

            <h1 className="flex items-center justify-center gap-3 text-3xl font-extrabold tracking-tight text-red-700 sm:text-5xl">
              GET HELP NOW
            </h1>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-red-900/70 sm:text-base">
              Broken down? Find nearby emergency vehicle assistance
              quickly. We rank providers by availability, ETA and
              distance.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* MAIN CONTENT                                             */}
      {/* ========================================================= */}

      <div className="container-nw mx-auto mt-6 max-w-xl px-4">
        {/* ===================================================== */}
        {/* LOCATION CARD                                         */}
        {/* ===================================================== */}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-red-600" />

            <div>
              <p className="text-sm font-bold text-slate-900">
                Your location
              </p>

              <p className="text-xs text-slate-500">
                Required to find the fastest help
              </p>
            </div>
          </div>

          <LocationPicker
            value={loc?.label}
            onPick={(location) => {
              setLoc(location);
              setError(null);
            }}
          />

          {gettingLocation && (
            <div className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />

              Detecting your current location...
            </div>
          )}

          {!gettingLocation &&
            (!loc ||
              typeof loc.lat !== "number" ||
              typeof loc.lng !== "number") && (
              <button
                type="button"
                onClick={retryLocation}
                className="mt-3 text-sm font-semibold text-red-600 underline hover:text-red-700"
              >
                Use my current location
              </button>
            )}
        </div>

        {/* ===================================================== */}
        {/* SERVICE SELECTION                                     */}
        {/* ===================================================== */}

        {!service && (
          <>
            <div className="mt-6">
              <h2 className="text-lg font-bold text-slate-900">
                What do you need?
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Choose one service to find nearby assistance.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {HELP.map((item) => {
                const ServiceIcon = item.icon;

                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => search(item)}
                    disabled={loading || gettingLocation}
                    className="
                      group
                      flex min-h-[125px]
                      flex-col items-center justify-center
                      gap-3 rounded-2xl
                      border border-slate-200
                      bg-white p-4
                      text-slate-800
                      shadow-sm
                      transition
                      hover:border-red-300
                      hover:bg-red-50
                      hover:shadow-md
                      active:scale-[0.98]
                      disabled:cursor-not-allowed
                      disabled:opacity-60
                    "
                  >
                    <span
                      aria-hidden="true"
                      className="
                        grid h-14 w-14
                        place-items-center
                        rounded-2xl
                        bg-red-50
                        text-red-600
                        transition
                        group-hover:bg-red-100
                      "
                    >
                      <ServiceIcon className="h-7 w-7" />
                    </span>

                    <span className="font-bold">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ===================================================== */}
        {/* SEARCH RESULTS                                       */}
        {/* ===================================================== */}

        {service && (
          <>
            {/* Change service */}
            <button
              type="button"
              onClick={resetSearch}
              className="
                mt-5
                text-sm font-semibold
                text-slate-500
                transition
                hover:text-red-700
              "
            >
              â† Change help type
            </button>

            {/* Selected service */}
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-white text-red-600 shadow-sm">
                {(() => {
                  const ServiceIcon = service.icon;

                  return (
                    <ServiceIcon className="h-6 w-6" />
                  );
                })()}
              </div>

              <div>
                <p className="text-xs font-medium text-red-700">
                  Looking for
                </p>

                <p className="font-bold text-red-900">
                  {service.label}
                </p>
              </div>
            </div>

            {/* Loading */}
            {loading && (
              <div
                className="
                  mt-4
                  flex items-center gap-3
                  rounded-2xl
                  border border-slate-200
                  bg-white
                  p-5
                  shadow-sm
                "
                aria-busy="true"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50">
                  <Loader2
                    className="h-5 w-5 animate-spin text-red-600"
                    aria-hidden="true"
                  />
                </div>

                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Finding help near you...
                  </p>

                  <p className="mt-0.5 text-xs text-slate-500">
                    Searching for the fastest available{" "}
                    {service.label.toLowerCase()}.
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div
                role="alert"
                className="
                  mt-4
                  rounded-2xl
                  border border-red-200
                  bg-red-50
                  p-4
                "
              >
                <div className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

                  <div>
                    <p className="font-bold text-red-800">
                      Unable to find help
                    </p>

                    <p className="mt-1 text-sm text-red-700">
                      {error}
                    </p>

                    <button
                      type="button"
                      onClick={() => search(service)}
                      className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* No results */}
            {!loading &&
              !error &&
              summary &&
              items.length === 0 && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100">
                    <Wrench className="h-6 w-6 text-slate-500" />
                  </div>

                  <p className="mt-4 font-bold text-slate-900">
                    No nearby providers found
                  </p>

                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    No {service.label.toLowerCase()} providers
                    responded nearby right now.
                  </p>

                  <button
                    type="button"
                    onClick={resetSearch}
                    className="mt-4 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Try another service
                  </button>
                </div>
              )}

            {/* Results */}
            {!loading && items.length > 0 && (
              <section
                className="mt-5"
                aria-label={`${service.label} emergency providers`}
              >
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Fastest help near you
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      Providers are ranked by availability, ETA
                      and distance.
                    </p>
                  </div>

                  {summary?.searchedRadiusKm != null && (
                    <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      ~{summary.searchedRadiusKm} km
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-3">
                  {items.map((card, index) => (
                    <ResultCardView
                      key={card.id}
                      card={card}
                      index={index + 1}
                      onBook={(selectedCard) =>
                        setBooking(selectedCard)
                      }
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* ===================================================== */}
        {/* EMERGENCY PHONE NUMBERS                               */}
        {/* ===================================================== */}

        <section className="mt-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-100 text-red-600">
                <Phone className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-bold text-red-900">
                  Life-threatening emergency?
                </h2>

                <p className="mt-1 text-sm leading-5 text-red-800/80">
                  Contact emergency services first. Near Wheels is
                  for vehicle assistance.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <a
                href="tel:108"
                className="
                  flex items-center
                  justify-center gap-2
                  rounded-xl
                  bg-white
                  px-4 py-3
                  text-sm font-bold
                  text-red-700
                  shadow-sm
                  ring-1 ring-red-200
                  hover:bg-red-100
                "
              >
                <Phone className="h-4 w-4" />
                Ambulance 108
              </a>

              <a
                href="tel:112"
                className="
                  flex items-center
                  justify-center gap-2
                  rounded-xl
                  bg-red-600
                  px-4 py-3
                  text-sm font-bold
                  text-white
                  shadow-sm
                  hover:bg-red-700
                "
              >
                <Phone className="h-4 w-4" />
                Emergency 112
              </a>
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <p className="mt-6 text-center text-xs leading-5 text-slate-400">
          Near Wheels helps connect you with vehicle service
          providers. For medical, fire or police emergencies,
          contact the appropriate emergency service immediately.
        </p>
      </div>

      {/* ========================================================= */}
      {/* BOOKING SHEET                                            */}
      {/* ========================================================= */}

      {booking && (
        <BookingSheet
          card={booking}
          onClose={() => setBooking(null)}
        />
      )}
    </main>
  );
}