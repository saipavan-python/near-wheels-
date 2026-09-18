"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle2, AlertTriangle, Info, ExternalLink } from "lucide-react";
import { api } from "@/lib/ui";

interface AppNotification {
  id: string;
  title: string;
  body: string;
  kind: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

function KindIcon({ kind }: { kind: string }) {
  if (kind === "SUCCESS") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (kind === "WARN") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  if (kind === "ERROR") return <AlertTriangle className="h-4 w-4 text-red-600" />;
  return <Info className="h-4 w-4 text-brand-600" />;
}

export default function ProviderNotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ notifications: AppNotification[] }>("/api/notifications").then((d) => {
      setLoading(false);
      if (d.ok) {
        setNotifications(d.data.notifications || []);
        // Opening this page counts as reading them (stops the repeated alert).
        fetch("/api/notifications", { method: "POST" }).catch(() => undefined);
      }
    });
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
          {notifications.map((n) => {
            const Wrapper = n.link ? "a" : "div";
            const extra = n.link ? { href: n.link, target: "_blank", rel: "noreferrer" } : {};
            return (
              <Wrapper
                key={n.id}
                {...(extra as any)}
                className={`flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition ${n.link ? "hover:border-brand-200 hover:shadow-md" : ""} ${n.isRead ? "" : "bg-brand-50/50"}`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 font-bold">
                  <KindIcon kind={n.kind} />
                </span>
                <div className="min-w-0 flex-1">
                  <h4 className={`text-sm ${n.isRead ? "font-semibold text-slate-700" : "font-bold text-ink"}`}>{n.title}</h4>
                  <p className="mt-0.5 text-xs text-slate-600">{n.body}</p>
                  <span className="mt-1.5 block text-[10px] text-slate-400">
                    {new Date(n.createdAt).toLocaleString("en-IN")}
                    {n.link && <span className="ml-2 inline-flex items-center gap-1 font-bold text-brand-700">Open <ExternalLink className="h-2.5 w-2.5" /></span>}
                  </span>
                </div>
                {!n.isRead && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
              </Wrapper>
            );
          })}
        </div>
      )}
    </div>
  );
}