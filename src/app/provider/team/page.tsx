"use client";

import { useEffect, useState } from "react";
import { Users, Plus, ShieldCheck, UserCheck, Mail, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/ui";

export default function TeamPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("MANAGER");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadMembers = async () => {
    setLoading(true);
    const r = await fetch("/api/providers/me").then((res) => res.json());
    setLoading(false);
    if (r.ok) {
      const p = r.data.provider;
      if (p?.members) setMembers(p.members);
      else setMembers([{ id: "owner-1", role: "OWNER", user: { name: p?.businessName || "Owner", phone: p?.phone || "" } }]);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);

    const payload = {
      action: "ADD_STAFF_MEMBER",
      phone: phone.replace(/\D/g, ""),
      role,
    };

    const r = await api<{ message: string }>("/api/providers/actions", { json: payload });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error || "Failed to add team member");

    setMsg("Staff member added successfully!");
    setPhone("");
    loadMembers();
    setTimeout(() => setMsg(null), 3000);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Team & Staff Permissions</h1>
          <p className="mt-1 text-xs text-ink-mute">
            Invite managers, dispatchers, and drivers with granular workspace access control.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Add staff form */}
        <div className="lg:col-span-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-display text-base font-bold text-ink flex items-center gap-2">
            <Plus className="h-4 w-4 text-brand-600" /> Add Team Member
          </h2>

          {err && <p className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{err}</p>}
          {msg && <p className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800">{msg}</p>}

          <form onSubmit={handleAddMember} className="space-y-4">
            <div>
              <label className="label">Mobile Number *</label>
              <input
                required
                inputMode="numeric"
                className="input h-11 text-xs font-semibold"
                placeholder="10-digit mobile"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Role & Permissions *</label>
              <select className="input h-11 text-xs font-bold" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="MANAGER">MANAGER (Full operational access)</option>
                <option value="DISPATCHER">DISPATCHER (Bookings & calendar only)</option>
                <option value="FINANCE">FINANCE (Earnings & payouts only)</option>
              </select>
            </div>

            <button type="submit" disabled={busy} className="btn-primary w-full !py-3 text-xs font-bold shadow-md">
              {busy ? "Adding Member…" : "Grant Staff Access"}
            </button>
          </form>
        </div>

        {/* Member Roster */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-display text-base font-bold text-ink flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-600" /> Active Roster ({members.length})
          </h2>

          <div className="divide-y divide-slate-100">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white font-bold text-xs">
                    {(m.user?.name || m.user?.phone || "U").slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-bold text-ink">{m.user?.name || "Staff User"}</p>
                    <p className="text-slate-400">{m.user?.phone || ""}</p>
                  </div>
                </div>

                <span className={`rounded-full px-3 py-1 font-extrabold text-[10px] uppercase tracking-wider ${m.role === "OWNER" ? "bg-purple-50 text-purple-800 border border-purple-200" : "bg-slate-100 text-slate-700"}`}>
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
