"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

export default function ProviderNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        setLoading(false);
        if (d.ok) setNotifications(d.data?.notifications || []);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Notifications & Alerts</h1>
        <p className="mt-1 text-xs text-ink-mute">
          Stay updated on customer bookings, payouts, document verification, and system updates.
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-slate-400">Loading notifications…</div>
      ) : notifications.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Bell className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 font-bold text-ink text-base">No notifications</h3>
          <p className="mt-1 text-xs text-slate-500">You are all caught up!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 font-bold">
                <Bell className="h-4 w-4" />
              </span>
              <div>
                <h4 className="font-bold text-ink text-sm">{n.title}</h4>
                <p className="text-xs text-slate-600 mt-0.5">{n.body}</p>
                <span className="mt-1.5 block text-[10px] text-slate-400">
                  {new Date(n.createdAt).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
