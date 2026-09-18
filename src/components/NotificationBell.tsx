"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, AlertTriangle, CheckCircle2, Info, X, ExternalLink } from "lucide-react";
import { playDing, playNudge, primeTone } from "@/lib/ding";

const POLL_MS = 15000;
const NUDGE_MS = 60000;
const TOAST_MS = 8000;

export interface AppNotification {
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

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function markAllRead() {
  fetch("/api/notifications", { method: "POST" }).catch(() => undefined);
}

export function markRead(id: string) {
  fetch(`/api/notifications/${id}`, { method: "PATCH" }).catch(() => undefined);
}

/**
 * Notification bell with live polling, an audible tone on new notifications,
 * and a repeating reminder until the drawer is opened (opening = read).
 */
export default function NotificationBell({ signedIn = true }: { signedIn?: boolean }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<AppNotification | null>(null);
  const lastSeen = useRef(0);
  const lastNudgeAt = useRef(0);
  const firstPoll = useRef(true);
  const openRef = useRef(false);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const d = await res.json();
      if (!d.ok) return;
      const list: AppNotification[] = d.notifications || [];
      const count: number = d.unreadCount || 0;
      setItems(list);

      const grew = count > lastSeen.current;
      setUnread(count);
      lastSeen.current = count;

      if (grew && !firstPoll.current && !openRef.current) {
        const latest = list.find((n) => !n.isRead) || list[0];
        if (latest) {
          playDing();
          setToast(latest);
        }
      }

      // Repeat reminder: while unread notifications remain AND the drawer has
      // not been opened, re-nudge every NUDGE_MS.
      if (!firstPoll.current && count > 0 && !openRef.current && !document.hidden && Date.now() - lastNudgeAt.current > NUDGE_MS) {
        playNudge();
        lastNudgeAt.current = Date.now();
      }
      firstPoll.current = false;
    } catch {
      /* offline / not signed in — try again next poll */
    }
  }, []);

  const openDrawer = useCallback(() => {
    setOpen(true);
    markAllRead();
    setUnread(0);
    lastSeen.current = 0;
    setToast(null);
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    window.addEventListener("pointerdown", primeTone, { once: true });
    poll();
    const t = setInterval(poll, POLL_MS);
    const onShow = () => poll();
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("nw:auth", onShow);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("nw:auth", onShow);
      window.removeEventListener("pointerdown", primeTone);
    };
  }, [signedIn, poll]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  if (!signedIn) return null;

  return (
    <>
      {/* bell button */}
      <button
        onClick={() => (open ? setOpen(false) : openDrawer())}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-ink/10 bg-white text-ink-soft shadow-sm transition hover:border-brand-300 hover:text-brand-700"
      >
        <Bell className="h-[17px] w-[17px]" />
        {unread > 0 && (
          <>
            <span className="absolute top-0 right-0 grid h-4 min-w-4 animate-pulse place-items-center rounded-full bg-ink px-1 text-[9px] font-extrabold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
            <span className="absolute top-0 right-0 h-2 w-2 animate-ping rounded-full bg-red-500" />
          </>
        )}
      </button>

      {/* drawer */}
      {open && (
        <>
          <div className="fixed inset-0 z-[65]" onClick={() => setOpen(false)} />
          <div className="fixed right-3 top-14 z-[66] flex max-h-[min(70vh,26rem)] w-[22rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-ink/[0.07] bg-white shadow-lift sm:right-4">
            <div className="flex items-center justify-between border-b border-ink/5 px-4 py-3">
              <p className="text-sm font-extrabold text-ink">Notifications</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    markAllRead();
                    setUnread(0);
                    lastSeen.current = 0;
                  }}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-brand-700 hover:bg-brand-50"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
                <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1 text-ink-faint hover:bg-ink/5">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-6 py-10 text-center text-xs text-ink-mute">
                  You're all caught up.
                </div>
              ) : (
                <ul className="divide-y divide-ink/[0.04]">
                  {items.map((n) => (
                    <li key={n.id}>
                      <a
                        href={n.link || undefined}
                        onClick={() => {
                          markRead(n.id);
                          setOpen(false);
                        }}
                        className={`flex items-start gap-3 px-4 py-3 transition hover:bg-paper ${!n.isRead ? "bg-brand-50/50" : ""}`}
                      >
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-ink/[0.05]">
                          <KindIcon kind={n.kind} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[13px] leading-tight ${n.isRead ? "font-semibold text-ink-soft" : "font-bold text-ink"}`}>
                            {n.title}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-ink-mute">{n.body}</span>
                          <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-ink-faint">
                            {timeAgo(n.createdAt)}
                            {n.link && <ExternalLink className="h-2.5 w-2.5" />}
                          </span>
                        </span>
                        {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      {/* toast on new notification */}
      {toast && !open && (
        <div className="fixed bottom-4 right-4 z-[68] w-[20rem] max-w-[calc(100vw-2rem)] animate-[fadeSlideUp_0.25s_ease] rounded-2xl border border-ink/[0.07] bg-white p-3 shadow-lift">
          <a
            href={toast.link || undefined}
            onClick={() => markRead(toast.id)}
            className="flex items-start gap-3"
          >
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-50">
              <KindIcon kind={toast.kind} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-ink">{toast.title}</span>
              <span className="mt-0.5 line-clamp-2 block text-xs text-ink-mute">{toast.body}</span>
            </span>
          </a>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="absolute top-2 right-2 rounded-md p-1 text-ink-faint hover:bg-ink/5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
}