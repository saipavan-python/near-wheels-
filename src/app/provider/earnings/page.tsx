"use client";

import { useEffect, useState } from "react";
import { DollarSign, ArrowUpRight, ShieldCheck, Download, TrendingUp } from "lucide-react";

export default function EarningsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/providers/me")
      .then((r) => r.json())
      .then((d) => {
        setLoading(false);
        if (d.ok) setData(d.data);
      })
      .catch(() => setLoading(false));
  }, []);

  const earnings = data?.earnings || { gross: 0, net: 0 };
  const payouts = data?.payouts || [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Earnings & Financials</h1>
          <p className="mt-1 text-xs text-ink-mute">
            Track daily gross rental income, platform fees, and direct bank account payouts.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-bold text-slate-500">Gross Income</span>
          <p className="mt-2 font-display text-3xl font-extrabold text-ink">₹{(earnings.gross || 0).toLocaleString("en-IN")}</p>
          <p className="mt-1 text-[11px] text-slate-500">Total customer payments</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm">
          <span className="text-xs font-bold text-emerald-900">Net Provider Revenue</span>
          <p className="mt-2 font-display text-3xl font-extrabold text-emerald-800">₹{(earnings.net || earnings.gross || 0).toLocaleString("en-IN")}</p>
          <p className="mt-1 text-[11px] font-semibold text-emerald-700">95% Payout Share</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-bold text-slate-500">Payout Account</span>
          <p className="mt-2 font-bold text-ink text-sm">UPI / Bank Transfer</p>
          <p className="mt-1 text-[11px] font-semibold text-emerald-700">Direct Weekly Transfer</p>
        </div>
      </div>

      {/* Payout History */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-display text-lg font-bold text-ink">Payout & Transfer History</h2>

        {payouts.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No payouts processed yet. Completed bookings are settled weekly directly to your bank.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 text-xs">
            {payouts.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-bold text-ink">Payout #{p.id.slice(0, 8)}</p>
                  <p className="text-slate-400">{new Date(p.createdAt).toLocaleDateString("en-IN")}</p>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-emerald-700 text-sm">₹{p.netAmount}</span>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">{p.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
