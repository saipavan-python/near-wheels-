"use client";

import { useEffect, useRef, useState } from "react";
import { speechSupported, listenOnce, getCurrentPosition } from "@/lib/ui";
import LocationPicker from "./LocationPicker";
import { IconMic, IconSend } from "./icons";

const EXAMPLES = [
  "I need an auto nearby",
  "Find a self-drive car near me",
  "I need a driver tomorrow",
  "Find a tractor near my farm for 4 acres",
  "My car broke down near the forest gate",
];

/** Signature hero AI search (spec §72). Sends the request to the AI assistant. */
export default function HeroSearch() {
  const [text, setText] = useState("");
  const [when, setWhen] = useState<"NOW" | "LATER">("NOW");
  const [loc, setLoc] = useState<{ label: string; lat?: number; lng?: number } | null>(null);
  const [phIdx, setPhIdx] = useState(0);
  const [listening, setListening] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const t = setInterval(() => setPhIdx((i) => (i + 1) % EXAMPLES.length), 3200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => () => stopRef.current?.(), []);

  function submit() {
    let q = text.trim();
    if (!q && !loc) {
      setText(EXAMPLES[phIdx]);
      return;
    }
    if (loc && q.toLowerCase().includes(loc.label.split(",")[0].toLowerCase()) === false) {
      q += ` at ${loc.label}`;
    }
    if (when === "LATER") q += " tomorrow";
    else if (!/now|right now|today/i.test(q)) q += " now";
    window.dispatchEvent(new CustomEvent("nw:ai-ask", { detail: { text: q } }));
  }

  function mic() {
    if (listening) {
      stopRef.current?.();
      return;
    }
    if (!speechSupported()) {
      alert("Voice input isn't supported in this browser — you can type instead.");
      return;
    }
    setListening(true);
    stopRef.current = listenOnce(
      (t) => setText(t),
      () => setListening(false)
    );
  }

  async function gps() {
    try {
      const p = await getCurrentPosition();
      setLoc({ label: "Current location", lat: p.lat, lng: p.lng });
    } catch (e: any) {
      alert(e?.message || "Could not get your location");
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* timing segmented control */}
      <div className="mx-auto mb-3 flex w-fit rounded-full bg-white/80 p-1 shadow-sm ring-1 ring-slate-200 backdrop-blur">
        {(["NOW", "LATER"] as const).map((w) => (
          <button
            key={w}
            onClick={() => setWhen(w)}
            aria-pressed={when === w}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              when === w ? "bg-brand-600 text-white shadow" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {w === "NOW" ? " Book Now" : " Book Later"}
          </button>
        ))}
      </div>

      {/* the big AI field */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="group relative rounded-[26px] bg-gradient-to-br from-white to-slate-50 p-1.5 shadow-[0_8px_40px_-12px_rgba(4,120,87,.35)] ring-1 ring-slate-200 transition focus-within:ring-2 focus-within:ring-brand-500"
      >
        <div className="flex flex-col gap-2 rounded-[20px] px-3.5 pb-3 pt-3 sm:flex-row sm:items-center">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLES[phIdx]}
            aria-label="Tell Near Wheels what you need"
            className="min-w-0 flex-1 bg-transparent px-1 py-2 text-base outline-none placeholder:text-slate-400 sm:text-lg"
          />
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={mic}
                aria-label={listening ? "Stop listening" : "Speak instead of typing"}
                title="Speak"
                className={`relative flex h-10 w-10 items-center justify-center rounded-full transition ${
                  listening ? "mic-live bg-red-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <IconMic className="h-5 w-5" />
              </button>
              {!loc ? (
                <button
                  type="button"
                  onClick={gps}
                  aria-label="Use my current location"
                  title="Use my location"
                  className="flex h-10 items-center gap-1.5 rounded-full bg-slate-100 px-3.5 text-sm font-semibold text-slate-600 hover:bg-slate-200"
                >
                   Near me
                </button>
              ) : (
                <span className="badge badge-green max-w-[140px] truncate"> {loc.label}</span>
              )}
            </div>
            <button
              type="submit"
              aria-label="Search with AI"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-md transition hover:bg-brand-700 active:scale-95"
            >
              <IconSend className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* optional explicit location picker row */}
        <details className="px-3.5 pb-1">
          <summary className="cursor-pointer select-none text-xs font-semibold text-slate-400 hover:text-brand-700">
            Or choose a village / town precisely
          </summary>
          <div className="pt-2">
            <LocationPicker value={loc?.label} onPick={setLoc} compact />
          </div>
        </details>
      </form>

      <p className="mt-3 text-center text-xs text-slate-400">
        English · తెలుగు · हिंदी · voice supported · free to search
      </p>
    </div>
  );
}
