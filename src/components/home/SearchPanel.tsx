"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, CalendarDays, CarFront, Search } from "lucide-react";
import LocationPicker from "../LocationPicker";

const TYPES = [
  ["", "Any type"],
  ["SUV", "SUV"],
  ["CAR", "Car"],
  ["AUTO", "Auto"],
  ["BIKE", "Bike"],
  ["VAN", "Van / Traveller"],
  ["TRACTOR", "Tractor"],
];

export default function SearchPanel() {
  const router = useRouter();
  const [loc, setLoc] = useState<{ label: string; lat?: number; lng?: number } | null>(null);
  const [date, setDate] = useState("");
  const [type, setType] = useState("");
  const [mode, setMode] = useState("");

  function search() {
    const p = new URLSearchParams();
    if (loc?.lat != null && loc?.lng != null) {
      p.set("lat", String(loc.lat));
      p.set("lng", String(loc.lng));
      p.set("locationText", loc.label);
    } else if (loc?.label) {
      p.set("locationText", loc.label);
    }
    if (date) p.set("date", date);
    if (type) p.set("category", type);
    if (mode) p.set("rentalMode", mode);
    router.push(`/vehicles?${p.toString()}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        search();
      }}
      className="grid gap-2 rounded-3xl bg-white p-3 shadow-lift ring-1 ring-black/5 md:grid-cols-[1.6fr_1fr_1fr_1fr_auto] md:items-center md:gap-0 md:divide-x md:divide-ink/[0.08] md:rounded-full md:py-2 md:pl-6 md:pr-2"
    >
      <div className="flex items-center gap-3 px-1 py-2">
        <MapPin className="h-[18px] w-[18px] shrink-0 text-brand-500" />
        <div className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">Location</span>
          <LocationPicker
            value={loc?.label || ""}
            onPick={(l) => setLoc(l)}
            compact
          />
        </div>
      </div>

      <div className="flex items-center gap-3 px-1 py-2 md:pl-5">
        <CalendarDays className="h-[18px] w-[18px] shrink-0 text-brand-500" />
        <div className="w-full">
          <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">Pickup</span>
          <input
            type="date"
            value={date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Pickup date"
            className="w-full bg-transparent text-sm font-semibold text-ink outline-none placeholder:text-ink-faint"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 px-1 py-2 md:pl-5">
        <CarFront className="h-[18px] w-[18px] shrink-0 text-brand-500" />
        <div className="w-full">
          <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            aria-label="Vehicle type"
            className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
          >
            {TYPES.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 px-1 py-2 md:pl-5">
        <div className="w-full">
          <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">Driver</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            aria-label="Rental mode"
            className="w-full bg-transparent text-sm font-semibold text-ink outline-none"
          >
            <option value="">Any</option>
            <option value="WITH_DRIVER">With driver</option>
            <option value="SELF_DRIVE">Self-drive</option>
          </select>
        </div>
      </div>

      <button type="submit" className="btn-primary !rounded-full !px-7 !py-3.5 md:ml-5">
        <Search className="h-4 w-4" />
        Search Wheels
      </button>
    </form>
  );
}
