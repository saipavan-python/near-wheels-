"use client";

import { useEffect, useRef, useState } from "react";
import { api, getCurrentPosition, pushRecentLocation, readRecentLocations } from "@/lib/ui";
import { IconPin } from "./icons";
import { MapPin, History, Loader2, Navigation } from "lucide-react";

export interface PickedLocation {
  label: string;
  lat?: number;
  lng?: number;
}

/**
 * Location selector (spec §85): current GPS, search with autocomplete,
 * recent locations. Calls onPick with a resolved label + coordinates when known.
 */
export default function LocationPicker({
  value,
  onPick,
  compact = false,
}: {
  value?: string | null;
  onPick: (loc: PickedLocation) => void;
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<{ id: string; label: string; lat: number; lng: number }[]>([]);
  const [recents, setRecents] = useState(readRecentLocations());
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const r = await api<{ locations: any[] }>(`/api/locations?q=${encodeURIComponent(q)}`);
      setOptions(r.data.locations || []);
    }, 180);
    return () => clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function useGps() {
    setLocating(true);
    try {
      const { lat, lng } = await getCurrentPosition();
      const label = "Current location";
      pushRecentLocation({ label, lat, lng });
      setRecents(readRecentLocations());
      setOpen(false);
      onPick({ label, lat, lng });
    } catch (e: any) {
      alert(e.message || "Could not get your location");
    }
    setLocating(false);
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white text-left transition hover:border-brand-500 ${compact ? "px-3 py-2" : "px-3.5 py-2.5"}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2">
          <IconPin className="h-4 w-4 shrink-0 text-brand-600" />
          <span className={`truncate ${value ? "text-sm font-medium text-slate-800" : "text-sm text-slate-400"}`}>
            {value || "Where do you need it?"}
          </span>
        </span>
        <span className="text-xs font-semibold text-brand-700">Change</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="p-2">
            <input
              autoFocus
              className="input"
              placeholder="Search village, town or landmark…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search location"
            />
          </div>
          <div className="max-h-64 overflow-y-auto pb-1">
            <Row onClick={useGps} icon={locating ? <Loader2 className="h-4 w-4 animate-spin text-brand-500" /> : <Navigation className="h-4 w-4 text-brand-500" />} title="Use my current location" sub="GPS" />
            {!q &&
              recents.map((r) => (
                <Row
                  key={r.label + String(r.at)}
                  icon={<History className="h-4 w-4 text-ink-faint" />}
                  title={r.label}
                  sub="Recent"
                  onClick={() => {
                    pushRecentLocation(r);
                    setOpen(false);
                    onPick(r);
                  }}
                />
              ))}
            {options.map((o) => (
              <Row
                key={o.id}
                icon={<MapPin className="h-4 w-4 text-brand-500" />}
                title={o.label}
                sub=""
                onClick={() => {
                  pushRecentLocation({ label: o.label, lat: o.lat, lng: o.lng });
                  setRecents(readRecentLocations());
                  setOpen(false);
                  onPick({ label: o.label, lat: o.lat, lng: o.lng });
                }}
              />
            ))}
            {q && options.length === 0 && (
              <p className="px-3 py-3 text-sm text-slate-500">
                No match for “{q}”. Try a nearby town, or use your current location.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-brand-50"
    >
      <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-paper">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-800">{title}</span>
        {sub && <span className="block text-xs text-slate-400">{sub}</span>}
      </span>
    </button>
  );
}
