"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResultCard, PriceQuote, PublicBooking } from "@/lib/ui";
import { api, inr, newIdemKey, fmtWhen } from "@/lib/ui";
import { IconX, IconCheck } from "./icons";
import { Zap, CalendarClock } from "lucide-react";

type Mode = "NOW" | "LATER";

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Shared booking sheet (spec §46/§90): quote from backend price engine,
 * Book Now / Book Later, idempotent create, then simulated gateway payment.
 * The UI never computes prices — /api/quote and POST /api/bookings decide.
 */
export default function BookingSheet({
  card,
  acresHint,
  presetDate,
  onClose,
}: {
  card: ResultCard;
  acresHint?: number;
  /** Date the customer picked during search ("YYYY-MM-DD") — pre-schedules the booking. */
  presetDate?: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(presetDate ? "LATER" : card.availableNow ? "NOW" : "LATER");
  const [date, setDate] = useState(presetDate || addDays(1));
  const [time, setTime] = useState("09:00");

  // quantity inputs - correct logic per vehicleConfig
  const selfDriveOk = card.meta.selfDrive === true;
  const withDriverOk = card.meta.withDriver === true;
  const bothModes = selfDriveOk && withDriverOk;
  const [sdMode, setSdMode] = useState<"SELF_DRIVE" | "WITH_DRIVER">(
    card.kind === "VEHICLE" ? (selfDriveOk && !withDriverOk ? "SELF_DRIVE" : "WITH_DRIVER") : "WITH_DRIVER"
  );
  const [days, setDays] = useState(1);
  const [hours, setHours] = useState<number | null>(null);
  const [acres, setAcres] = useState<number | null>(
    card.kind === "FARM" || card.kind === "DRONE" ? acresHint ?? null : null
  );
  const [km, setKm] = useState<number | null>(null);
  const [rule, setRule] = useState<{ model: string; dailyRate?: number | null; hourlyRate?: number | null; perKm?: number | null; perAcre?: number | null; visitCharge?: number | null; includedKmPerDay?: number | null; extraPerKm?: number | null } | null>(null);

  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [booking, setBooking] = useState<PublicBooking | null>(null);
  const [payState, setPayState] = useState<"IDLE" | "CREATING" | "VERIFYING" | "SUCCESS" | "FAILED">("IDLE");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const scheduledForIso = useMemo(() => {
    if (mode === "NOW") return null;
    if (!date) return null;
    const d = new Date(`${date}T${time || "09:00"}:00`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }, [mode, date, time]);

  const fetchQuote = useCallback(async () => {
    setQuoting(true);
    const r = await api<{ quote: PriceQuote; rule: { model: string } | null }>("/api/quote", {
      json: {
        kind: card.kind,
        id: card.id,
        providerId: card.providerId,
        days: card.kind === "VEHICLE" || card.kind === "DRIVER" ? days : mode === "NOW" ? undefined : days,
        hours: hours ?? undefined,
        km: km ?? undefined,
        acres: acres ?? undefined,
      },
    });
    setQuoting(false);
    if (r.ok) {
      setQuote(r.data.quote);
      setRule((r.data as any).rule || null);
      // auto-set hours/km visibility based on rule model
      const m = (r.data as any).rule?.model;
      if (m === "HOURLY" && hours == null) setHours(4);
      if (m === "PER_KM" && km == null) setKm(50);
    }
  }, [card, days, hours, km, acres, mode]);

  useEffect(() => {
    if (!booking) fetchQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchQuote]);

  async function confirm() {
    setBusy(true);
    setErr(null);
    const kind =
      card.kind === "VEHICLE"
        ? sdMode === "SELF_DRIVE"
          ? "VEHICLE_SELF_DRIVE"
          : "VEHICLE_WITH_DRIVER"
        : card.kind === "DRIVER"
        ? "DRIVER"
        : card.kind === "GARAGE"
        ? "GARAGE"
        : card.kind === "FARM"
        ? "FARM_EQUIPMENT"
        : "DRONE_SPRAYING";

    const r = await api<{ booking: PublicBooking }>("/api/bookings", {
      headers: { "Idempotency-Key": newIdemKey() },
      json: {
        kind,
        listingKind: card.kind,
        listingId: card.id,
        vehicleId: card.kind === "VEHICLE" ? card.id : undefined,
        scheduledFor: scheduledForIso,
        durationDays: card.kind === "VEHICLE" ? days : days > 0 ? days : undefined,
        durationHours: hours ?? undefined,
        acres: acres ?? undefined,
        estKm: km ?? undefined,
        ac: card.kind === "VEHICLE" ? card.meta.ac === true : null,
        locationText: card.distanceKm != null ? `near selected search area` : undefined,
        notes: "",
      },
    });
    setBusy(false);
    if (r.status === 401) {
      // Persist booking intent so after login we return automatically (spec §1)
      try {
        sessionStorage.setItem("nw_pending_booking", JSON.stringify({ card, scheduledForIso, days, hours, km, acres, sdMode }));
        sessionStorage.setItem("nw_redirect_next", window.location.pathname + window.location.search);
      } catch {}
      window.dispatchEvent(new CustomEvent("nw:open-login", { detail: { message: "To book this vehicle, please create an account or log in." } }));
      setErr("To book this vehicle, please create an account or log in. After login you'll return here.");
      return;
    }
    if (r.status === 409) {
      setErr(r.data.error || "That option was just booked. Try another nearby option.");
      return;
    }
    if (!r.ok) {
      setErr(r.data.error || "Could not create booking.");
      return;
    }
    setBooking(r.data.booking);
  }

  async function pay() {
    if (!booking) return;
    setPayState("CREATING");
    setErr(null);
    const c = await api<{ payment: { gatewayRef: string } }>("/api/payments", { json: { bookingId: booking.id } });
    if (!c.ok) {
      setPayState("FAILED");
      setErr(c.data.error || "Could not start payment.");
      return;
    }
    setPayState("VERIFYING");
    // Simulated gateway callback — production replaces this with a real gateway redirect/webhook.
    const v = await api("/api/payments", { method: "PUT", json: { gatewayRef: c.data.payment.gatewayRef, outcome: "success" } });
    if (v.ok && v.data.status === "SUCCESS") {
      setPayState("SUCCESS");
      window.dispatchEvent(new Event("nw:bookings-updated"));
    } else {
      setPayState("FAILED");
      setErr(v.data.message || "Payment could not be completed. You can try again.");
    }
  }

  const total = booking?.totalAmount ?? quote?.total ?? 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm booking"
    >
      <div
        className="sheet-in max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {booking && (payState === "SUCCESS" || booking.status === "CONFIRMED" || booking.status === "COMPLETED") ? (
          <SuccessBody booking={booking} onClose={onClose} />
        ) : (
          <>
            {/* header */}
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden className="text-2xl">{card.emoji}</span>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold">{booking?.listingTitle || card.title}</h2>
                  <p className="truncate text-xs text-slate-500">
                    {booking?.providerName || card.subtitle}
                  </p>
                </div>
              </div>
              <button aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" onClick={onClose}>
                <IconX className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              {/* timing */}
              {!booking && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${mode === "NOW" ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600 hover:border-brand-400"}`}
                      onClick={() => setMode("NOW")}
                    >
                      <Zap className="h-4 w-4 text-brand-500" /> Right now
                    </button>
                    <button
                      className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${mode === "LATER" ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600 hover:border-brand-400"}`}
                      onClick={() => setMode("LATER")}
                    >
                      <CalendarClock className="h-4 w-4 text-brand-500" /> Schedule
                    </button>
                  </div>

                  {mode === "LATER" && (
                    <div className="anim-in grid grid-cols-2 gap-2">
                      <div>
                        <label className="label" htmlFor="bk-date">Date</label>
                        <input id="bk-date" type="date" className="input" min={addDays(0)} value={date} onChange={(e) => setDate(e.target.value)} />
                      </div>
                      <div>
                        <label className="label" htmlFor="bk-time">Time</label>
                        <input id="bk-time" type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
                      </div>
                    </div>
                  )}

                  {/* vehicle rental mode — shows Self-Drive / With Driver correctly */}
                  {card.kind === "VEHICLE" && (
                    bothModes ? (
                      <div className="grid grid-cols-2 gap-2">
                        {(["SELF_DRIVE", "WITH_DRIVER"] as const).map((m) => (
                          <button
                            key={m}
                            className={`flex h-12 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition ${sdMode === m ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600 hover:border-brand-400"}`}
                            onClick={() => setSdMode(m)}
                          >
                            {m === "SELF_DRIVE" ? "Self-drive" : "With driver"}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-xl bg-paper px-3 py-2.5 text-sm font-semibold text-ink-mute">
                        {selfDriveOk ? "Self-drive only" : "With driver only"} {card.meta.ac ? "• AC" : ""}
                      </p>
                    )
                  )}

                  {/* Customer can choose how to pay: Days / Hours / Kilometers — works for any vehicle */}
                  {card.kind === "VEHICLE" && (
                    <div>
                      <span className="label">Book by *</span>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { key: "DAYS", label: "Days", desc: rule?.dailyRate ? `₹${rule.dailyRate}/day` : "Per day" },
                          { key: "HOURS", label: "Hours", desc: rule?.hourlyRate ? `₹${rule.hourlyRate}/hr` : "Per hour" },
                          { key: "KM", label: "Kilometers", desc: rule?.perKm ? `₹${rule.perKm}/km` : "Per km" },
                        ].map((tab) => {
                          const active = (rule?.model === "HOURLY" && tab.key === "HOURS") || (rule?.model === "PER_KM" && tab.key === "KM") || (tab.key === "DAYS" && !["HOURLY","PER_KM"].includes(rule?.model || ""));
                          // For customer choice, highlight the provider's primary model as default but allow switching
                          const isSelected = (hours != null && tab.key === "HOURS") || (km != null && tab.key === "KM" && hours == null) || (tab.key === "DAYS" && hours == null && km == null);
                          const selected = isSelected || (tab.key === "DAYS" && !hours && !km);
                          return (
                            <button
                              key={tab.key}
                              type="button"
                              onClick={() => {
                                if (tab.key === "DAYS") { setHours(null); setKm(null); }
                                if (tab.key === "HOURS") { setHours(4); setKm(null); }
                                if (tab.key === "KM") { setHours(null); setKm(50); }
                              }}
                              className={`rounded-xl border px-3 py-3 text-center transition ${selected ? "border-brand-600 bg-brand-50 text-brand-800 shadow-sm" : "border-ink/15 bg-white text-ink-mute hover:border-brand-400"}`}
                            >
                              <span className="block text-sm font-bold">{tab.label}</span>
                              <span className="block text-xs text-ink-faint">{tab.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-xs text-ink-faint">Provider’s primary: <span className="font-semibold text-ink">{rule?.model || "DAILY"}</span> — you can still choose hours or km, quote will adapt.</p>
                    </div>
                  )}

                  {/* Inputs based on customer choice (hours vs km vs days) */}
                  {hours != null ? (
                    <div>
                      <label className="label" htmlFor="bk-hours">Hours needed *</label>
                      <div className="flex items-center gap-2">
                        <button className="btn-outline h-12 !px-4" aria-label="Fewer hours" onClick={() => setHours((h) => Math.max(1, (h || 4) - 1))}>−</button>
                        <span id="bk-hours" className="w-12 text-center text-base font-bold">{hours}</span>
                        <button className="btn-outline h-12 !px-4" aria-label="More hours" onClick={() => setHours((h) => Math.min(24, (h || 4) + 1))}>+</button>
                        <span className="ml-2 text-xs text-ink-faint">hourly {rule?.hourlyRate ? `₹${rule.hourlyRate}/hr` : ""}</span>
                      </div>
                    </div>
                  ) : km != null ? (
                    <div>
                      <label className="label" htmlFor="bk-km">Distance (km) *</label>
                      <input id="bk-km" type="number" min={1} className="input h-12" placeholder="e.g. 120" value={km} onChange={(e) => setKm(e.target.value ? Number(e.target.value) : null)} />
                      <p className="mt-1 text-xs text-ink-faint">Pay per km {rule?.perKm ? `₹${rule.perKm}/km` : ""} {rule?.includedKmPerDay ? `(first ${rule.includedKmPerDay}km/day free)` : ""}</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <label className="label mb-0 shrink-0" htmlFor="bk-days">Days *</label>
                      <div className="flex items-center gap-2">
                        <button className="btn-outline h-12 !px-4" aria-label="Fewer days" onClick={() => setDays((d) => Math.max(1, d - 1))}>−</button>
                        <span id="bk-days" className="w-12 text-center text-base font-bold">{days}</span>
                        <button className="btn-outline h-12 !px-4" aria-label="More days" onClick={() => setDays((d) => Math.min(30, d + 1))}>+</button>
                      </div>
                      {rule?.dailyRate && <span className="text-xs text-ink-faint">₹{rule.dailyRate}/day</span>}
                      {rule?.model === "MIXED" && <span className="text-xs text-ink-faint">+ extra km @ ₹{rule.extraPerKm}/km</span>}
                    </div>
                  )}
                  {hours == null && km == null && rule?.model === "MIXED" && (
                    <div>
                      <label className="label" htmlFor="bk-km-mixed">Total distance (km) *</label>
                      <input id="bk-km-mixed" type="number" min={0} className="input h-12" placeholder="e.g. 250" value={km ?? ""} onChange={(e) => setKm(e.target.value ? Number(e.target.value) : null)} />
                      <p className="mt-1 text-xs text-ink-faint">Includes {rule.includedKmPerDay || 100}km/day, extra @ ₹{rule.extraPerKm}/km</p>
                    </div>
                  )}

                  {(card.kind === "FARM" || card.kind === "DRONE") && (
                    <div>
                      <label className="label" htmlFor="bk-acres">Acres *</label>
                      <input id="bk-acres" type="number" min={1} className="input h-12" placeholder={`e.g. ${acresHint ?? 5}`} value={acres ?? ""} onChange={(e) => setAcres(e.target.value ? Math.max(0.5, Number(e.target.value)) : null)} />
                    </div>
                  )}
                </>
              )}

              {/* price breakdown from backend engine */}
              <section aria-label="Price estimate" className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700">Price details</h3>
                  {quote?.confidence === "ESTIMATE" && (
                    <span className="badge bg-amber-100 text-amber-800">Estimated</span>
                  )}
                </div>
                {quoting && !quote ? (
                  <div className="space-y-2">
                    <div className="skeleton h-4 w-3/4" />
                    <div className="skeleton h-4 w-1/2" />
                  </div>
                ) : quote && quote.lines.length > 0 ? (
                  <ul className="space-y-1.5">
                    {quote.lines.map((l, i) => (
                      <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="text-slate-600">{l.label}</span>
                        <span className="font-semibold text-slate-800">{inr(l.amount)}</span>
                      </li>
                    ))}
                    <li className="mt-2 flex items-baseline justify-between gap-3 border-t border-dashed border-slate-300 pt-2">
                      <span className="font-bold text-slate-900">Total</span>
                      <span className="text-lg font-extrabold tracking-tight text-slate-900">{inr(total)}</span>
                    </li>
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">
                    Final pricing is set by the provider — you&apos;ll see it on the booking before you confirm.
                  </p>
                )}
                {quote?.disclaimer && <p className="mt-2 text-xs text-slate-500">{quote.disclaimer}</p>}
              </section>

              {/* post-create status */}
              {booking && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 anim-in">
                  <p className="font-semibold">
                    {booking.status === "PENDING_PROVIDER"
                      ? "Request sent to provider — waiting for acceptance."
                      : booking.status === "CONFIRMED"
                      ? "Booking confirmed."
                      : ["ACCEPTED"].includes(booking.status)
                      ? "Provider accepted your request."
                      : `Status: ${booking.status}`}
                  </p>
                  <p className="mt-1 text-xs">
                    Booking code <strong>{booking.code}</strong> · {fmtWhen(booking.scheduledFor)}
                  </p>

                  {payState !== "SUCCESS" && ["ACCEPTED", "PENDING_PROVIDER"].includes(booking.status) && (
                    <div className="mt-3 space-y-2">
                      <button
                        className="btn-primary w-full !py-2.5"
                        disabled={!["ACCEPTED"].includes(booking.status) || payState === "CREATING" || payState === "VERIFYING"}
                        onClick={pay}
                      >
                        {payState === "CREATING" || payState === "VERIFYING"
                          ? "Processing payment…"
                          : `Pay securely · ${inr(booking.totalAmount)}`}
                      </button>
                      {booking.status === "PENDING_PROVIDER" && (
                        <p className="text-center text-[11px] text-emerald-700">
                          Payment unlocks once the provider accepts.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {err && (
                <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600" role="alert">
                  {err}
                  {err.includes("just booked") && (
                    <button className="link ml-2 text-red-700" onClick={onClose}>
                      See other options
                    </button>
                  )}
                </p>
              )}
            </div>

            {/* footer CTA */}
            {!booking && (
              <div className="sticky bottom-0 border-t border-slate-100 bg-white px-5 py-4">
                <button
                  className="btn-primary w-full !py-3 text-base disabled:opacity-60"
                  disabled={busy || ((card.kind === "FARM" || card.kind === "DRONE") && !acres)}
                  onClick={confirm}
                >
                  {busy ? "Sending request…" : mode === "NOW" ? ` Confirm booking` : ` Confirm booking`}
                </button>
                <p className="mt-2 text-center text-[11px] text-slate-400">
                  No advance needed to request · Free cancellation before service starts
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SuccessBody({ booking, onClose }: { booking: PublicBooking; onClose: () => void }) {
  return (
    <div className="px-6 py-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <IconCheck className="h-8 w-8 text-emerald-600" />
      </div>
      <h2 className="mt-4 text-xl font-bold"> Booking confirmed</h2>
      <p className="mt-1 text-sm text-slate-500">
        {booking.listingTitle} with {booking.providerName} — no payment needed right now.
      </p>
      <p className="mt-4 inline-block rounded-xl bg-slate-100 px-4 py-2 font-mono text-sm font-bold tracking-wider">
        {booking.code}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <a href="/bookings" className="btn-primary !py-2.5">View my bookings</a>
        <button className="btn-outline !py-2.5" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
