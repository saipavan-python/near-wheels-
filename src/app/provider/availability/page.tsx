"use client";

import { useEffect, useState } from "react";
import { Calendar as CalendarIcon, Clock, AlertTriangle, Plus, Power, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/ui";

const REASONS = [
  "Personal use",
  "Maintenance",
  "Already booked elsewhere",
  "Driver unavailable",
  "Documents expired",
  "Other",
];

export default function AvailabilityPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [availabilities, setAvailabilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Block form
  const [reason, setReason] = useState("Personal use");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const loadAssets = async () => {
    const r = await fetch("/api/provider/assets").then((res) => res.json());
    if (r.ok && r.data.assets?.length > 0) {
      setAssets(r.data.assets);
      setSelectedVehicleId(r.data.assets[0].id);
      loadAvailability(r.data.assets[0].id);
    } else {
      setLoading(false);
    }
  };

  const loadAvailability = async (vId: string) => {
    setLoading(true);
    const r = await fetch(`/api/provider/availability?vehicleId=${vId}`).then((res) => res.json());
    setLoading(false);
    if (r.ok) setAvailabilities(r.data.availabilities || []);
  };

  useEffect(() => {
    loadAssets();
  }, []);

  function handleVehicleSelect(vId: string) {
    setSelectedVehicleId(vId);
    loadAvailability(vId);
  }

  async function handleCreateBlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);

    const payload = {
      vehicleId: selectedVehicleId,
      reason,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      note,
    };

    const r = await api<{ message: string }>("/api/provider/availability", { json: payload });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error || "Could not save availability block");

    setMsg("Availability block saved successfully!");
    setNote("");
    loadAvailability(selectedVehicleId);
    setTimeout(() => setMsg(null), 3000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Availability & Calendar</h1>
        <p className="mt-1 text-xs text-ink-mute">
          Set custom unavailability dates and reasons (personal use, maintenance, external booking) for double-booking protection.
        </p>
      </div>

      {assets.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-xs font-bold text-slate-500">
          No assets listed yet. Add a vehicle or equipment first to manage availability.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Form Panel */}
          <div className="lg:col-span-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="font-display text-base font-bold text-ink flex items-center gap-2">
              <Power className="h-4 w-4 text-brand-600" /> Mark Unavailability Range
            </h2>

            {err && <p className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{err}</p>}
            {msg && <p className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800">{msg}</p>}

            <form onSubmit={handleCreateBlock} className="space-y-4">
              <div>
                <label className="label">Select Asset *</label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => handleVehicleSelect(e.target.value)}
                  className="input h-11 text-xs font-bold"
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} ({a.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Reason for Unavailability *</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="input h-11 text-xs font-bold"
                >
                  {REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Start Date *</label>
                  <input
                    type="date"
                    required
                    className="input h-11 text-xs"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">End Date *</label>
                  <input
                    type="date"
                    required
                    className="input h-11 text-xs"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="label">Remarks / Note (Optional)</label>
                <input
                  className="input h-11 text-xs"
                  placeholder="e.g. Scheduled oil change & brake pad replacement"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <button type="submit" disabled={busy} className="btn-primary w-full !py-3 text-xs font-bold shadow-md">
                {busy ? "Saving Range…" : "Block Selected Dates"}
              </button>
            </form>
          </div>

          {/* Timeline / Records View */}
          <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="font-display text-base font-bold text-ink flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-brand-600" /> Active Availability Blocks
            </h2>

            {loading ? (
              <div className="py-8 text-center text-xs font-bold text-slate-400">Loading blocks…</div>
            ) : availabilities.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-8 text-center text-xs font-semibold text-slate-500">
                No custom unavailability blocks set for this asset. Asset is fully available for bookings.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {availabilities.map((blk) => (
                  <div key={blk.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 font-bold text-rose-800">
                        {blk.reason || "Blocked"}
                      </span>
                      <p className="mt-1 font-bold text-ink">
                        {new Date(blk.startDate).toLocaleDateString("en-IN")} → {new Date(blk.endDate).toLocaleDateString("en-IN")}
                      </p>
                      {blk.note && <p className="text-slate-500 italic mt-0.5">{blk.note}</p>}
                    </div>

                    <span className="text-[11px] font-semibold text-slate-400">
                      Added {new Date(blk.createdAt).toLocaleDateString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
