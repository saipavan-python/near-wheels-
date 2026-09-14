"use client";

import { useEffect, useState } from "react";
import { TrendingUp, CarFront, Calendar, DollarSign, Clock } from "lucide-react";

export default function AnalyticsPage() {
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

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Fleet Analytics & Utilization</h1>
        <p className="mt-1 text-xs text-ink-mute">
          Performance metrics, vehicle utilization rates, peak booking days, and revenue breakdown.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-bold text-slate-500">Fleet Utilization</span>
          <p className="mt-2 font-display text-3xl font-extrabold text-brand-700">78%</p>
          <p className="mt-1 text-[11px] font-semibold text-emerald-700">+12% vs last month</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-bold text-slate-500">Average Trip Duration</span>
          <p className="mt-2 font-display text-3xl font-extrabold text-ink">2.4 Days</p>
          <p className="mt-1 text-[11px] text-slate-500">Self-drive & Outstation</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-bold text-slate-500">Top Performing Category</span>
          <p className="mt-2 font-display text-2xl font-extrabold text-ink">7-Seater MUV</p>
          <p className="mt-1 text-[11px] font-semibold text-emerald-700">Highest Demand</p>
        </div>
      </div>
    </div>
  );
}
