"use client";

import { CheckCircle2, AlertTriangle, Fuel, Receipt, Coins, MapPin, Clock3, Users } from "lucide-react";
import { inr } from "@/lib/ui";

type Line = { label: string; amount: number; confidence: "CONFIRMED" | "ESTIMATE" | "PROVIDER_CONFIRMATION"; source: string; note?: string };

interface Props {
  budget: number;
  estimatedTotal: number;
  delta: number;
  possible: boolean;
  confidence: string;
  disclaimer: string;
  distance?: { oneWayKm: number; totalKm: number; roundTrip: boolean; source: string; note?: string } | null;
  lines: Line[];
  from?: string | null;
  to?: string | null;
  pax?: number | null;
  days?: number | null;
  onBookCheapest?: () => void;
  compact?: boolean;
}

function ConfidenceBadge({ c }: { c: Line["confidence"] }) {
  if (c === "CONFIRMED") return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">✓ Confirmed</span>;
  if (c === "ESTIMATE") return <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">~ Estimated</span>;
  return <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">⚠ Provider confirmation</span>;
}

export default function BudgetTripCard({ budget, estimatedTotal, delta, possible, disclaimer, distance, lines, from, to, pax, days, onBookCheapest, compact }: Props) {
  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${possible ? "border-emerald-200" : "border-amber-200"}`}>
      {/* header */}
      <div className={`flex items-start gap-3 px-4 py-3 ${possible ? "bg-emerald-50/70" : "bg-amber-50/70"}`}>
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${possible ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {possible ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-extrabold ${possible ? "text-emerald-900" : "text-amber-900"}`}>
            {possible ? "✓ Trip is possible" : "✕ Trip may not fit your budget"}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            {from && to ? `${from} → ${to}` : ""} {days ? `· ${days} day${days > 1 ? "s" : ""}` : ""} {pax ? `· ${pax} people` : ""}
            {distance ? ` · ${distance.totalKm} km ${distance.roundTrip ? "round trip" : "one way"}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Budget</p>
          <p className="text-base font-extrabold text-slate-900">{inr(budget)}</p>
        </div>
      </div>

      {/* comparison */}
      <div className="grid grid-cols-2 gap-3 px-4 py-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-slate-500"><Receipt className="h-3.5 w-3.5" /> Estimated total</p>
          <p className="mt-1 text-lg font-extrabold tracking-tight text-slate-900">{inr(estimatedTotal)}</p>
          <p className="text-[11px] text-slate-500">{distance?.source === "OSRM" ? "road distance" : "estimated distance"}</p>
        </div>
        <div className={`rounded-xl p-3 ${possible ? "bg-emerald-50" : "bg-red-50"}`}>
          <p className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide ${possible ? "text-emerald-700" : "text-red-700"}`}>
            <Coins className="h-3.5 w-3.5" /> {possible ? "Remaining" : "Additional needed"}
          </p>
          <p className={`mt-1 text-lg font-extrabold tracking-tight ${possible ? "text-emerald-800" : "text-red-700"}`}>{inr(Math.abs(delta))}</p>
          <p className="text-[11px] text-slate-500">{possible ? "within budget" : "over budget"}</p>
        </div>
      </div>

      {/* distance details */}
      {distance && !compact && (
        <div className="flex flex-wrap items-center gap-3 border-y border-slate-100 bg-white px-4 py-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {distance.oneWayKm} km one way → {distance.totalKm} km total</span>
          <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> ~{Math.round(distance.totalKm / 28 * 60)} min</span>
          {pax ? <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {pax} pax</span> : null}
          <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">{distance.source === "OSRM" ? "road routing" : "estimate"}</span>
        </div>
      )}

      {/* itemized lines */}
      <div className="px-4 py-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500"><Fuel className="h-3.5 w-3.5" /> Cost breakdown</p>
        <ul className="space-y-1.5">
          {lines.map((l, i) => (
            <li key={i} className="flex items-start justify-between gap-3 text-sm">
              <span className="min-w-0 flex-1 text-slate-700">
                {l.label}
                {l.note ? <span className="block text-[11px] text-slate-400">{l.note}</span> : null}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{l.amount > 0 ? inr(l.amount) : "—"}</span>
                <ConfidenceBadge c={l.confidence} />
              </span>
            </li>
          ))}
          <li className="mt-2 flex items-center justify-between border-t border-dashed border-slate-200 pt-2">
            <span className="text-sm font-extrabold text-slate-900">Estimated total</span>
            <span className="text-base font-extrabold text-slate-900">{inr(estimatedTotal)}</span>
          </li>
        </ul>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{disclaimer}</p>
      </div>

      {onBookCheapest && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          <button onClick={onBookCheapest} className="btn-primary w-full !py-2.5">
            {possible ? "View options within budget" : "See cheaper alternatives"}
          </button>
          <p className="mt-1.5 text-center text-[11px] text-slate-400">Final price confirmed by provider before booking</p>
        </div>
      )}
    </div>
  );
}
