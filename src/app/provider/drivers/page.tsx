"use client";

import { useCallback, useEffect, useState } from "react";
import {
  UserRound,
  Plus,
  ShieldCheck,
  Phone,
  Star,
  X,
  CalendarClock,
  Trash2,
  ChevronDown,
  ChevronUp,
  Truck,
  Loader2,
} from "lucide-react";

const DRIVE_CATEGORIES = [
  { id: "CAR", label: "Car" },
  { id: "SUV", label: "SUV" },
  { id: "VAN", label: "Van" },
  { id: "PICKUP", label: "Pickup" },
  { id: "TRUCK", label: "Truck" },
  { id: "LORRY", label: "Lorry" },
  { id: "BUS", label: "Bus" },
  { id: "AUTO", label: "Auto" },
  { id: "BIKE", label: "Bike" },
  { id: "TRACTOR", label: "Tractor" },
  { id: "OTHER", label: "Other" },
] as const;

const LICENSES = ["LMV", "LMV_TR", "HMV", "HPMV", "AUTO_RICKSHAW"] as const;

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

interface RosterDriver {
  id: string;
  name: string;
  phone: string | null;
  photoUrl: string | null;
  experienceYears: number;
  categories: string[];
  languages: string[];
  licenseType: string | null;
  status: string;
  verificationStatus: string;
  rating: number;
  ratingCount: number;
  isUnavailableToday: boolean;
  activeBookings: number;
  upcomingBlocks: { id: string; startAt: string; endAt: string; status: string; note: string | null }[];
}

export default function DriversPage() {
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<RosterDriver[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openAvail, setOpenAvail] = useState<string | null>(null);

  // add-driver form
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [experienceYears, setExperienceYears] = useState(2);
  const [licenseType, setLicenseType] = useState("LMV_TR");
  const [cats, setCats] = useState<string[]>(["CAR"]);

  // availability form
  const [avStart, setAvStart] = useState(addDays(1));
  const [avEnd, setAvEnd] = useState(addDays(1));
  const [avReason, setAvReason] = useState("OFF_DUTY");
  const [avSaving, setAvSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meR, driversR] = await Promise.all([
        fetch("/api/providers/me").then((r) => r.json()),
        fetch("/api/providers/drivers").then((r) => r.json()),
      ]);
      if (meR.ok) setMe(meR.data);
      if (driversR.ok) setDrivers(driversR.data.drivers || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggleCat(id: string) {
    setCats((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function addDriver() {
    setErr(null);
    if (!name.trim()) {
      setErr("Driver name is required");
      return;
    }
    if (!cats.length) {
      setErr("Select what this driver drives (e.g. Lorry, Truck, Car)");
      return;
    }
    setSaving(true);
    const r = await fetch("/api/providers/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, experienceYears, licenseType, categories: cats, languages: ["Telugu", "Hindi", "English"] }),
    }).then((res) => res.json());
    setSaving(false);
    if (!r.ok) {
      setErr(r.error || "Could not add driver");
      return;
    }
    setName("");
    setPhone("");
    setCats(["CAR"]);
    setShowAdd(false);
    await load();
  }

  async function toggleDriver(id: string) {
    const d = drivers.find((x) => x.id === id);
    if (!d) return;
    const r = await fetch(`/api/providers/drivers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: d.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
    }).then((res) => res.json());
    if (r.ok) await load();
  }

  async function deleteDriver(id: string) {
    if (!window.confirm("Remove this driver from the roster? Past bookings are kept.")) return;
    const r = await fetch(`/api/providers/drivers/${id}`, { method: "DELETE" }).then((res) => res.json());
    if (r.ok) await load();
  }

  async function addAvailability(driverId: string) {
    setErr(null);
    setAvSaving(true);
    const r = await fetch(`/api/providers/drivers/${driverId}/availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: avStart, endDate: avEnd, reason: avReason }),
    }).then((res) => res.json()).catch((e) => ({ ok: false, error: e.message }));
    setAvSaving(false);
    if (!r.ok) {
      setErr(r.error || "Could not set availability");
      return;
    }
    setAvStart(addDays(1));
    setAvEnd(addDays(1));
    await load();
  }

  async function deleteAvailability(driverId: string, availabilityId: string) {
    const r = await fetch(`/api/providers/drivers/${driverId}/availability/${availabilityId}`, { method: "DELETE" }).then((res) => res.json());
    if (r.ok) await load();
  }

  const driverProfile = me?.provider?.driverProfile;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Drivers & Roster</h1>
          <p className="mt-1 text-xs text-ink-mute">
            Add your drivers, tell customers what they drive (car, lorry, truck…), and manage their date availability like your vehicles.
          </p>
        </div>
        <button onClick={() => setShowAdd((s) => !s)} className="btn-primary !py-2.5 !px-5 text-xs font-bold shadow-md active:scale-[0.98]">
          <Plus className="h-4 w-4" /> Add Driver
        </button>
      </div>

      {err && <p className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700" role="alert">{err}</p>}

      {showAdd && (
        <div className="card space-y-4 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-ink">Add a driver to your roster</h3>
            <button onClick={() => setShowAdd(false)} className="text-ink-faint hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Full name *</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Srinivas Reddy" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" />
            </div>
            <div>
              <label className="label">Experience (years)</label>
              <input className="input" type="number" min={0} max={60} value={experienceYears} onChange={(e) => setExperienceYears(Number(e.target.value))} />
            </div>
            <div>
              <label className="label">License type</label>
              <select className="input" value={licenseType} onChange={(e) => setLicenseType(e.target.value)}>
                {LICENSES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">What does this driver drive? *</label>
            <div className="flex flex-wrap gap-2">
              {DRIVE_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCat(c.id)}
                  className={`rounded-full border px-3.5 py-2 text-xs font-bold transition ${cats.includes(c.id) ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand-400"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-ink-faint">Customers can filter drivers by what they drive — e.g. lorry, truck, car.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={addDriver} disabled={saving} className="btn-primary !py-2.5 !px-5 text-xs font-bold active:scale-[0.98]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Add to roster</>}
            </button>
            <button onClick={() => setShowAdd(false)} className="btn-outline !py-2.5 !px-5 text-xs font-bold">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-ink-mute">Loading driver roster…</div>
      ) : (
        <>
          {driverProfile && (
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-mute">Primary driver (you)</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 font-bold">
                      <UserRound className="h-5 w-5" />
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                      AVAILABLE NOW
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-ink text-base">{me.provider?.businessName || "Primary Driver"}</h3>
                    <p className="text-xs text-slate-500">License: {driverProfile.licenseType || "LMV_TR"} • {driverProfile.experienceYears || 8} Yrs Exp</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-mute">
              Roster drivers <span className="text-ink-faint">({drivers.length})</span>
            </h2>
            {drivers.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <Truck className="mx-auto h-10 w-10 text-slate-300" />
                <h3 className="mt-3 font-bold text-ink text-base">No roster drivers yet</h3>
                <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                  Add the drivers who work with you, pick what they drive (car, lorry, truck…), and set their available dates. They’ll show up when customers search.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {drivers.map((d) => (
                  <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`grid h-10 w-10 place-items-center rounded-xl ${d.isUnavailableToday ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"} font-bold`}>
                        <UserRound className="h-5 w-5" />
                      </span>
                      <div className="flex items-center gap-2">
                        {d.activeBookings > 0 && (
                          <span className="rounded-full bg-sky-50 border border-sky-200 px-2.5 py-0.5 text-[11px] font-bold text-sky-800">{d.activeBookings} booking{d.activeBookings > 1 ? "s" : ""}</span>
                        )}
                        <span className={`badge px-2.5 py-0.5 ${d.status === "ACTIVE" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                          {d.isUnavailableToday ? "Blocked today" : d.status === "ACTIVE" ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="flex items-center gap-2 font-bold text-ink text-base">
                        {d.name}
                        {d.verificationStatus === "VERIFIED" && <ShieldCheck className="h-4 w-4 text-emerald-600" />}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {d.licenseType || "LMV"} • {d.experienceYears} Yrs Exp
                        {d.phone ? <span className="ml-1 inline-flex items-center gap-1"><Phone className="h-3 w-3" />{d.phone}</span> : null}
                      </p>
                      {d.rating > 0 && <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-amber-700"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{d.rating.toFixed(1)} ({d.ratingCount})</p>}
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1">
                      <div>
                        <span className="text-slate-400">Drives:</span>{" "}
                        <span className="font-semibold text-slate-700">{d.categories.length ? d.categories.join(", ") : "—"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Languages:</span>{" "}
                        <span className="font-semibold text-slate-700">{d.languages.length ? d.languages.join(", ") : "—"}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                      <button
                        onClick={() => setOpenAvail((x) => (x === d.id ? null : d.id))}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:border-brand-400"
                      >
                        <CalendarClock className="h-3.5 w-3.5" /> Availability {openAvail === d.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                      <button onClick={() => toggleDriver(d.id)} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:border-brand-400">
                        {d.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </button>
                      <button onClick={() => deleteDriver(d.id)} className="inline-flex items-center gap-1 rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600 hover:border-red-300">
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                    </div>

                    {openAvail === d.id && (
                      <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="label !mb-1 !text-[10px]">From</label>
                            <input className="input !h-9 !px-2" type="date" value={avStart} min={addDays(0)} onChange={(e) => setAvStart(e.target.value)} />
                          </div>
                          <div>
                            <label className="label !mb-1 !text-[10px]">To</label>
                            <input className="input !h-9 !px-2" type="date" value={avEnd} min={avStart} onChange={(e) => setAvEnd(e.target.value)} />
                          </div>
                        </div>
                        <select className="input !h-9" value={avReason} onChange={(e) => setAvReason(e.target.value)}>
                          <option value="OFF_DUTY">Off duty</option>
                          <option value="ON_LEAVE">On leave</option>
                          <option value="ON_TRIP">On another trip</option>
                          <option value="OTHER">Other</option>
                        </select>
                        <button onClick={() => addAvailability(d.id)} disabled={avSaving} className="btn-primary w-full !py-2 text-[11px] font-bold active:scale-[0.99]">
                          {avSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Block these dates (unavailable)"}
                        </button>

                        {d.upcomingBlocks.length > 0 && (
                          <ul className="mt-1 space-y-1.5">
                            {d.upcomingBlocks.map((a) => (
                              <li key={a.id} className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 text-[11px]">
                                <span className="text-slate-600">
                                  {new Date(a.startAt).toLocaleDateString("en-IN")} → {new Date(a.endAt).toLocaleDateString("en-IN")}
                                  {a.note ? <span className="text-ink-faint"> • {a.note}</span> : null}
                                </span>
                                <button onClick={() => deleteAvailability(d.id, a.id)} className="text-red-500 hover:text-red-700" aria-label="Remove block"><X className="h-3.5 w-3.5" /></button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {d.upcomingBlocks.length === 0 && <p className="text-center text-[11px] text-ink-faint">No blocked dates — driver is available on all dates.</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}