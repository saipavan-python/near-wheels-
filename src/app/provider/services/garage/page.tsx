"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Wrench, Save, CheckCircle2, Clock } from "lucide-react";
import { api } from "@/lib/ui";

const GARAGE_SERVICES = [
  "MECHANIC",
  "ELECTRICAL",
  "AC_REPAIR",
  "WATER_SERVICE",
  "TOWING",
  "BREAKDOWN",
  "TYRE",
  "BATTERY",
];

export default function GarageManagementPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [open24x7, setOpen24x7] = useState(true);
  const [opensAt, setOpensAt] = useState("08:00");
  const [closesAt, setClosesAt] = useState("20:00");
  const [pickupDrop, setPickupDrop] = useState(true);
  const [selectedServices, setSelectedServices] = useState<string[]>(["MECHANIC", "TOWING", "TYRE", "BATTERY"]);
  const [visitCharge, setVisitCharge] = useState("300");

  useEffect(() => {
    fetch("/api/providers/me")
      .then((r) => r.json())
      .then((d) => {
        setLoading(false);
        if (d.ok && d.data.provider?.garageProfile) {
          const g = d.data.provider.garageProfile;
          setOpen24x7(!!g.open24x7);
          if (g.opensAt) setOpensAt(g.opensAt);
          if (g.closesAt) setClosesAt(g.closesAt);
          setPickupDrop(!!g.pickupDrop);
          if (g.services) {
            try { setSelectedServices(JSON.parse(g.services)); } catch {}
          }
        }
      })
      .catch(() => setLoading(false));
  }, []);

  function toggleService(srv: string) {
    if (selectedServices.includes(srv)) {
      setSelectedServices(selectedServices.filter((s) => s !== srv));
    } else {
      setSelectedServices([...selectedServices, srv]);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);

    const payload = {
      action: "UPDATE_GARAGE",
      garage: {
        open24x7,
        opensAt,
        closesAt,
        pickupDrop,
        services: selectedServices,
        visitCharge: Number(visitCharge) || 300,
      },
    };

    const r = await api<{ message: string }>("/api/providers/actions", { json: payload });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error || "Failed to update garage profile");

    setMsg("Garage profile updated successfully!");
    setTimeout(() => setMsg(null), 3000);
  }

  if (loading) {
    return <div className="py-12 text-center text-xs font-bold text-slate-400">Loading garage profile…</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/provider/services" className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to Services
        </Link>
        <span className="text-xs font-bold text-sky-700">Garage & Breakdown Profile</span>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">Garage Setup & Working Hours</h1>
          <p className="mt-1 text-xs text-slate-500">
            Configure your workshop capabilities, 24x7 emergency response setting, and service visit charges.
          </p>
        </div>

        {err && <p className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{err}</p>}
        {msg && <p className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800">{msg}</p>}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Services Checklist */}
          <div>
            <label className="label">Services Offered *</label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {GARAGE_SERVICES.map((srv) => {
                const active = selectedServices.includes(srv);
                return (
                  <button
                    key={srv}
                    type="button"
                    onClick={() => toggleService(srv)}
                    className={`flex items-center justify-between rounded-xl border p-3 text-xs font-bold transition ${
                      active ? "border-sky-500 bg-sky-50/60 text-sky-900" : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    <span>{srv.replace(/_/g, " ")}</span>
                    <span className={`h-4 w-4 rounded-full border grid place-items-center text-[10px] ${active ? "bg-sky-600 text-white border-sky-600" : "border-slate-300"}`}>
                      {active ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Standard Visit Charge (₹)</label>
              <input type="number" className="input h-11" value={visitCharge} onChange={(e) => setVisitCharge(e.target.value)} />
            </div>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input type="checkbox" checked={open24x7} onChange={(e) => setOpen24x7(e.target.checked)} className="h-4 w-4 rounded accent-sky-600" />
                24×7 Breakdown Emergency Service
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Link href="/provider/services" className="btn-outline !py-2.5 !px-5 text-xs font-bold">
              Cancel
            </Link>
            <button type="submit" disabled={busy} className="btn-primary !py-2.5 !px-6 text-xs font-bold shadow-md">
              <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save Garage Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
