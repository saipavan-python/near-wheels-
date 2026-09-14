"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings, Save, Building2, MapPin, Phone, ShieldCheck } from "lucide-react";
import { api } from "@/lib/ui";

export default function BusinessSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressText, setAddressText] = useState("");
  const [autoAccept, setAutoAccept] = useState(true);

  useEffect(() => {
    fetch("/api/providers/me")
      .then((r) => r.json())
      .then((d) => {
        setLoading(false);
        if (d.ok && d.data.provider) {
          const p = d.data.provider;
          setBusinessName(p.businessName || "");
          setPhone(p.phone || "");
          setAddressText(p.addressText || "");
          setAutoAccept(!!p.autoAccept);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);

    const payload = {
      action: "UPDATE_BUSINESS",
      businessName,
      phone,
      addressText,
      autoAccept,
    };

    const r = await api<{ message: string }>("/api/providers/actions", { json: payload });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error || "Failed to save settings");

    setMsg("Business settings saved successfully!");
    setTimeout(() => setMsg(null), 3000);
  }

  if (loading) {
    return <div className="py-12 text-center text-xs font-bold text-slate-400">Loading business settings…</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Business & Account Settings</h1>
        <p className="mt-1 text-xs text-ink-mute">
          Manage your organization name, contact details, base location, and auto-dispatch rules.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
        {err && <p className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{err}</p>}
        {msg && <p className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800">{msg}</p>}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Registered Business / Trade Name *</label>
              <input
                required
                className="input h-11"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Primary Phone Number *</label>
              <input
                required
                className="input h-11"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Base Location Address *</label>
            <input
              required
              className="input h-11"
              value={addressText}
              onChange={(e) => setAddressText(e.target.value)}
            />
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">Dispatch & Auto-Accept Rules</h3>
            <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-ink">
              <input
                type="checkbox"
                checked={autoAccept}
                onChange={(e) => setAutoAccept(e.target.checked)}
                className="h-4 w-4 rounded accent-brand-600"
              />
              Enable Instant Auto-Accept for verified bookings
            </label>
            <p className="text-[11px] text-slate-500 leading-normal pl-7">
              When enabled, incoming customer rental requests for available assets will be accepted automatically without waiting for manual confirmation.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button type="submit" disabled={busy} className="btn-primary !py-2.5 !px-6 text-xs font-bold shadow-md">
              <Save className="h-4 w-4" /> {busy ? "Saving Settings…" : "Save Business Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
