"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Trash2, Calendar, Power, AlertTriangle, ShieldCheck } from "lucide-react";
import { api } from "@/lib/ui";

export default function EditAssetPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [asset, setAsset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [seats, setSeats] = useState("4");
  const [dailyRate, setDailyRate] = useState("");
  const [perKm, setPerKm] = useState("");

  const loadAsset = async () => {
    setLoading(true);
    const r = await fetch(`/api/provider/assets/${params.id}`).then((res) => res.json());
    setLoading(false);
    if (r.ok) {
      const a = r.data.asset;
      setAsset(a);
      setTitle(a.title || "");
      setStatus(a.status || "ACTIVE");
      setSeats(String(a.seats || 4));
      if (a.pricing) {
        setDailyRate(a.pricing.dailyRate ? String(a.pricing.dailyRate) : "");
        setPerKm(a.pricing.perKm ? String(a.pricing.perKm) : "");
      }
    } else {
      setErr(r.error || "Failed to load asset details");
    }
  };

  useEffect(() => {
    loadAsset();
  }, [params.id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);

    const payload = {
      title,
      status,
      seats: Number(seats) || 4,
      pricing: {
        dailyRate: dailyRate ? Number(dailyRate) : null,
        perKm: perKm ? Number(perKm) : null,
      },
    };

    const r = await api<{ message: string }>(`/api/provider/assets/${params.id}`, {
      method: "PATCH",
      json: payload,
    });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error || "Failed to update asset");

    setMsg("Asset updated successfully!");
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this asset listing?")) return;
    setBusy(true);
    const r = await api(`/api/provider/assets/${params.id}`, { method: "DELETE" });
    setBusy(false);
    if (r.ok) router.push("/provider/assets");
    else setErr(r.data.error || "Could not delete asset");
  }

  if (loading) {
    return <div className="py-12 text-center text-xs font-bold text-slate-500">Loading asset settings…</div>;
  }

  if (!asset) {
    return <div className="py-12 text-center text-xs font-bold text-red-600">Asset not found.</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/provider/assets" className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to Assets
        </Link>
        <span className="text-xs font-bold text-slate-500">ID: {asset.id}</span>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-700">{asset.category}</span>
            <h1 className="font-display text-2xl font-extrabold text-ink">{asset.title}</h1>
            <p className="mt-1 text-xs text-slate-500">{asset.make} {asset.model} • Reg: {asset.registrationNumber || "N/A"}</p>
          </div>
          <button onClick={handleDelete} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100">
            <Trash2 className="h-4 w-4" /> Delete Asset
          </button>
        </div>

        {err && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{err}</p>}
        {msg && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800">{msg}</p>}

        <form onSubmit={handleSave} className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Asset Title</label>
              <input className="input h-11" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="label">Operational Status</label>
              <select className="input h-11 font-bold" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="ACTIVE">ACTIVE (Available for booking)</option>
                <option value="NOT_AVAILABLE">NOT AVAILABLE (Temporarily blocked)</option>
                <option value="MAINTENANCE">MAINTENANCE (In service bay)</option>
                <option value="INACTIVE">INACTIVE (Hidden from marketplace)</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Seats</label>
              <input type="number" className="input h-11" value={seats} onChange={(e) => setSeats(e.target.value)} />
            </div>
            <div>
              <label className="label">Daily Rate (₹/day)</label>
              <input type="number" className="input h-11" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} />
            </div>
            <div>
              <label className="label">Per Km Rate (₹/km)</label>
              <input type="number" className="input h-11" value={perKm} onChange={(e) => setPerKm(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Link href="/provider/assets" className="btn-outline !py-2.5 !px-5 text-xs font-bold">
              Cancel
            </Link>
            <button type="submit" disabled={busy} className="btn-primary !py-2.5 !px-6 text-xs font-bold shadow-md">
              <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
