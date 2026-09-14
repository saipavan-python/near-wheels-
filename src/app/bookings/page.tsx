"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { PublicBooking } from "@/lib/ui";
import { api, inr, fmtWhen, BOOKING_STATUS_META } from "@/lib/ui";
import { CreditCard, Star, CalendarDays, Inbox, Trash2 } from "lucide-react";
import LoginModal from "@/components/LoginModal";

const TONE: Record<string, string> = {
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
  blue: "bg-sky-100 text-sky-800",
  gray: "bg-slate-200 text-slate-600",
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<PublicBooking[] | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewFor, setReviewFor] = useState<PublicBooking | null>(null);

  const load = useCallback(async () => {
    const me = await api<{ user: { id: string } | null }>("/api/auth/me");
    setAuthed(!!me.data.user);
    if (!me.data.user) {
      setBookings([]);
      return;
    }
    const r = await api<{ bookings: PublicBooking[] }>("/api/bookings");
    setBookings(r.ok ? r.data.bookings : []);
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("nw:bookings-updated", load);
    window.addEventListener("nw:auth", load);
    return () => {
      window.removeEventListener("nw:bookings-updated", load);
      window.removeEventListener("nw:auth", load);
    };
  }, [load]);

  async function act(b: PublicBooking, action: string) {
    setBusyId(b.id);
    await api(`/api/bookings/${b.id}`, { method: "PATCH", json: { action } });
    setBusyId(null);
    load();
  }

  async function removeBooking(b: PublicBooking) {
    if (!confirm("Delete this booking?")) return;
    const r = await api(`/api/bookings/${b.id}`, { method: "DELETE" });
    if (r.ok) load();
  }

  async function payAgain(b: PublicBooking) {
    setBusyId(b.id);
    const c = await api<{ payment: { gatewayRef: string } }>("/api/payments", { json: { bookingId: b.id } });
    if (c.ok) {
      const v = await api("/api/payments", { method: "PUT", json: { gatewayRef: c.data.payment.gatewayRef, outcome: "success" } });
      if (!(v.ok && v.data.status === "SUCCESS")) alert(v.data.message || "Payment could not be completed.");
    }
    setBusyId(null);
    load();
  }

  if (authed === null) {
    return <div className="container-nw py-16"><div className="skeleton mx-auto h-40 max-w-lg" /></div>;
  }

  if (!authed) {
    return (
      <div className="container-nw flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-paper-deep text-ink-mute"><CalendarDays className="h-7 w-7" /></span>
        <h1 className="text-xl font-bold">Log in to see your bookings</h1>
        <p className="max-w-sm text-sm text-slate-500">
          Your booking history, receipts and live status live here — free account, just a mobile number.
        </p>
        <button className="btn-primary !px-8 !py-3" onClick={() => window.dispatchEvent(new CustomEvent("nw:open-login"))}>
          Login
        </button>
        <LoginModal />
      </div>
    );
  }

  const active = (bookings || []).filter((b) =>
    ["REQUESTED", "PENDING_PROVIDER", "ACCEPTED", "CONFIRMED", "EN_ROUTE", "IN_PROGRESS"].includes(b.status)
  );
  const past = (bookings || []).filter((b) =>
    ["COMPLETED", "CANCELLED", "REJECTED", "REFUNDED", "DISPUTED"].includes(b.status)
  );

  return (
    <div className="container-nw max-w-3xl py-8">
      <h1 className="text-2xl font-extrabold tracking-tight">My Bookings</h1>
      <p className="mt-1 text-sm text-slate-500">Live status updates appear here as providers respond.</p>

      {bookings === null && <div className="skeleton mt-6 h-32 w-full" />}

      {bookings && bookings.length === 0 && (
        <div className="card mt-6 p-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-paper-deep text-ink-mute"><Inbox className="h-6 w-6" /></span>
          <h2 className="mt-3 font-bold">No bookings yet</h2>
          <p className="mt-1 text-sm text-slate-500">Tell the AI what you need — or browse vehicles near you.</p>
          <Link href="/" className="btn-primary mt-4 !py-2.5">Get started</Link>
        </div>
      )}

      {(active.length > 0 || past.length > 0) && (
        <div className="mt-6 space-y-8">
          {[
            ["Upcoming & active", active],
            ["Past", past],
          ].map(([label, list]) =>
            (list as PublicBooking[]).length > 0 ? (
              <section key={label as string}>
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">{label as string}</h2>
                <div className="mt-3 space-y-3">
                  {(list as PublicBooking[]).map((b) => (
                    <article key={b.id} className="card p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-bold">{b.listingTitle}</h3>
                            <Badge status={b.status} />
                            {b.paymentStatus !== "UNPAID" && b.paymentStatus !== "PAID" && (
                              <span className={`badge ${TONE.amber}`}>{b.paymentStatus}</span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {b.providerName} · code {b.code} · {fmtWhen(b.scheduledFor)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-base font-extrabold">{inr(b.totalAmount)}</div>
                          {b.depositAmount ? <div className="text-[11px] text-slate-400">+{inr(b.depositAmount)} deposit</div> : null}
                        </div>
                      </div>

                      <div className="mt-3.5 flex flex-wrap gap-2 border-t border-slate-100 pt-3.5">
                        {["ACCEPTED", "PENDING_PROVIDER"].includes(b.status) && b.paymentStatus === "UNPAID" && (
                          <button
                            className={b.status === "ACCEPTED" ? "btn-primary !py-2" : "btn-outline !py-2"}
                            disabled={b.status !== "ACCEPTED" || busyId === b.id}
                            title={b.status === "PENDING_PROVIDER" ? "Unlocks when the provider accepts" : ""}
                             onClick={() => payAgain(b)}
                           >
                             <CreditCard className="h-4 w-4" /> Pay {inr(b.totalAmount)}
                           </button>
                        )}
                        {["REQUESTED", "PENDING_PROVIDER", "ACCEPTED", "CONFIRMED"].includes(b.status) && (
                          <button className="btn-outline !py-2" disabled={busyId === b.id} onClick={() => act(b, "cancel")}>
                            Cancel
                          </button>
                        )}
                        {b.status === "COMPLETED" && !b.review && (
                          <button className="btn-accent !py-2" onClick={() => setReviewFor(b)}>
                            <Star className="h-4 w-4" /> Rate
                          </button>
                        )}
                        {["COMPLETED", "CANCELLED", "REJECTED", "REFUNDED", "DISPUTED"].includes(b.status) && (
                          <button className="rounded-xl border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-100" onClick={() => removeBooking(b)}>
                            Delete
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null
          )}
        </div>
      )}

      {/* review modal */}
      {reviewFor && (
        <ReviewModal
          booking={reviewFor}
          onClose={() => setReviewFor(null)}
          onDone={() => {
            setReviewFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const meta = BOOKING_STATUS_META[status] || { label: status, tone: "gray" as const };
  return <span className={`badge ${TONE[meta.tone]}`}>{meta.label}</span>;
}

function ReviewModal({ booking, onClose, onDone }: { booking: PublicBooking; onClose: () => void; onDone: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    const r = await api("/api/reviews", { json: { bookingId: booking.id, rating, comment } });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error || "Could not save review");
    onDone();
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="sheet-in w-full max-w-md rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-bold">How was {booking.providerName}?</h2>
        <p className="mt-0.5 text-xs text-slate-500">{booking.listingTitle} · {booking.code}</p>
        <div className="mt-4 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} aria-label={`${n} star${n > 1 ? "s" : ""}`} className="transition hover:scale-110" onClick={() => setRating(n)}>
              <Star className={`h-8 w-8 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-ink-faint"}`} />
            </button>
          ))}
        </div>
        <textarea
          className="input mt-4 min-h-[80px]"
          placeholder="Anything to share? (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 500))}
        />
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        <button className="btn-primary mt-4 w-full !py-2.5" disabled={busy} onClick={submit}>
          {busy ? "Saving…" : "Submit review"}
        </button>
      </div>
    </div>
  );
}
