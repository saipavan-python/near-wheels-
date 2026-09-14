"use client";

import { useEffect, useRef, useState } from "react";
import type { ResultCard } from "@/lib/ui";
import { api, inr, speechSupported, listenOnce } from "@/lib/ui";
import ResultCardView from "./ResultCardView";
import BookingSheet from "./BookingSheet";
import BudgetTripCard from "./BudgetTripCard";
import { IconChat, IconMic, IconSend, IconX } from "./icons";
import { CarFront } from "lucide-react";

interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  payload?: {
    cards?: ResultCard[];
    table?: { title?: string; headers: string[]; rows: (string | number)[][] };
    locationOptions?: { id: string; label: string }[];
    needsLogin?: boolean;
    needsPayment?: { bookingId: string; amount: number } | null;
    suggestions?: string[];
    tripPlan?: {
      budgetComparison: { budget: number; estimatedTotal: number; delta: number; possible: boolean; confidence: string; disclaimer: string };
      distance: { oneWayKm: number; totalKm: number; source: string };
      cheapest: { title: string; total: number; confidence: string; lines: unknown };
      options: Array<{ title: string; total: number; confidence: string; lines: unknown }>;
    };
    tripCost?: { lines: { label: string; amount: number; confidence: string; source: string; note?: string }[]; total: number; confidence: string; disclaimer: string; distance?: { oneWayKm: number; totalKm: number; source: string } | null };
    quote?: { lines: { label: string; amount: number }[]; total: number; confidence: string; disclaimer?: string };
  };
}

const ROTATING = [
  "I need an auto right now…",
  "Find a self-drive car near me…",
  "I need a driver tomorrow…",
  "Find a tractor near my farm…",
  "My car broke down…",
];

/**
 * Floating AI assistant. Talks only to /api/chat — every marketplace claim
 * in its replies comes from backend tools (search/price/booking), never invented.
 */
export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<"IDLE" | "THINKING">("IDLE");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const stopListenRef = useRef<(() => void) | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [placeholder, setPlaceholder] = useState(ROTATING[0]);
  const [bookingCard, setBookingCard] = useState<ResultCard | null>(null);

  // rotating placeholder
  useEffect(() => {
    if (open) return;
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % ROTATING.length;
      setPlaceholder(ROTATING[i]);
    }, 3500);
    return () => clearInterval(t);
  }, [open]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => scrollToBottom());
  }, [msgs, open]);

  function scrollToBottom() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || phase === "THINKING") return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: message }]);
    setPhase("THINKING");

    const pageContext = typeof window !== "undefined" ? window.location.pathname : "/";
    const r = await api<{
      conversationId: string;
      reply: string;
      payload: ChatMsg["payload"];
    }>("/api/chat", { json: { message, conversationId, pageContext } });

    setPhase("IDLE");
    if (!r.ok) {
      setMsgs((m) => [
        ...m,
        { role: "assistant", text: r.data.error || "I couldn't reach the assistant service just now. Please try again." },
      ]);
      return;
    }
    setConversationId(r.data.conversationId || conversationId);
    setMsgs((m) => [...m, { role: "assistant", text: r.data.reply || "Here's what I found.", payload: r.data.payload }]);
  }

  // external ask (hero search, service pages)
  useEffect(() => {
    function onAsk(e: Event) {
      const detail = (e as CustomEvent).detail || {};
      setOpen(true);
      if (detail.text) setTimeout(() => send(String(detail.text)), 60);
    }
    window.addEventListener("nw:ai-ask", onAsk);
    return () => window.removeEventListener("nw:ai-ask", onAsk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, phase]);

  function toggleMic() {
    if (listening) {
      stopListenRef.current?.();
      stopListenRef.current = null;
      setListening(false);
      return;
    }
    if (!speechSupported()) {
      alert("Voice input isn't supported on this browser. You can type instead.");
      return;
    }
    setListening(true);
    stopListenRef.current = listenOnce(
      (t) => setInput(t),
      () => {
        setListening(false);
        stopListenRef.current = null;
      }
    );
  }

  return (
    <>
      {/* floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Near Wheels AI assistant"
          className="fixed bottom-20 right-4 z-50 flex h-14 items-center gap-2 rounded-full bg-ink pl-4 pr-5 text-sm font-bold text-white shadow-lift ring-1 ring-white/10 transition hover:bg-ink-soft md:bottom-6"
        >
          <span className="grid h-8 w-8 -ml-1 place-items-center rounded-full bg-brand-500">
            <IconChat className="h-[18px] w-[18px]" />
          </span>
          Ask Near Wheels
        </button>
      )}

      {/* panel */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-[55] flex h-[85dvh] flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-slate-50 shadow-2xl sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[600px] sm:max-w-md sm:rounded-3xl">
          {/* header */}
          <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-ink px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-white">
                <IconChat className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold leading-tight">Near Wheels AI</p>
                <p className="text-[11px] leading-tight text-white/50">
                  {phase === "THINKING" ? " Thinking…" : listening ? " Listening…" : "What do you need?"}
                </p>
              </div>
            </div>
            <button aria-label="Close assistant" className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white" onClick={() => setOpen(false)}>
              <IconX className="h-5 w-5" />
            </button>
          </div>

          {/* messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4" aria-live="polite">
            {msgs.length === 0 && (
              <div className="mx-auto max-w-xs pt-8 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600" aria-hidden>
                  <CarFront className="h-7 w-7" />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-700">Tell me what you need</p>
                <p className="mt-1 text-xs text-slate-500">
                  A ride, a driver, a garage, a tractor or drone spraying — in your own words.
                </p>
                <div className="mt-4 space-y-2">
                  {ROTATING.slice(0, 3).map((s) => (
                    <button key={s} className="chip w-full !py-2" onClick={() => send(s.replace("…", ""))}>
                      “{s}”
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "chat-bubble-user" : "chat-bubble-bot anim-in"}>
                {m.role === "assistant" && i === msgs.length - 1 && phase === "THINKING" ? (
                  <TypingDots />
                ) : (
                  m.text
                )}
                {m.payload?.locationOptions && m.payload.locationOptions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.payload.locationOptions.map((o) => (
                      <button key={o.id} className="chip !border-brand-300 !text-brand-700" onClick={() => send(o.label)}>
                         {o.label}
                      </button>
                    ))}
                  </div>
                )}
                {m.payload?.cards && m.payload.cards.length > 0 && (
                  <div className={`mt-2.5 space-y-2.5 ${m.role === "assistant" ? "" : "hidden"}`}>
                    {m.payload.cards.map((c, ci) => (
                      <ResultCardView
                        key={c.kind + c.id}
                        card={c}
                        compact
                        bestMatch={ci === 0 && m.payload!.cards!.length > 1}
                        onBook={(card) => setBookingCard(card)}
                      />
                    ))}
                  </div>
                )}
                {m.payload?.table && (
                  <div className="mt-2.5 overflow-x-auto rounded-xl border border-slate-100 bg-slate-50 p-2">
                    <table className="w-full min-w-[260px] text-left text-xs">
                      <thead>
                        <tr>
                          {(m.payload.table.headers || []).map((h, hi) => (
                            <th key={hi} className="px-2 py-1 font-bold text-slate-500">{String(h)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(m.payload.table.rows || []).map((row, ri) => (
                          <tr key={ri} className="border-t border-slate-100">
                            {row.map((cell, cidx) => (
                              <td key={cidx} className={`px-2 py-1 ${cidx === 0 ? "font-semibold text-slate-500" : "text-slate-700"}`}>
                                {String(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {m.payload?.tripPlan && (
                  <div className="mt-2.5">
                    <BudgetTripCard
                      budget={m.payload.tripPlan.budgetComparison.budget}
                      estimatedTotal={m.payload.tripPlan.budgetComparison.estimatedTotal}
                      delta={m.payload.tripPlan.budgetComparison.delta}
                      possible={m.payload.tripPlan.budgetComparison.possible}
                      confidence={m.payload.tripPlan.budgetComparison.confidence}
                      disclaimer={m.payload.tripPlan.budgetComparison.disclaimer}
                      distance={m.payload.tripPlan.distance as unknown as { oneWayKm: number; totalKm: number; roundTrip: boolean; source: string } | null}
                      lines={(m.payload.tripPlan.cheapest.lines as unknown as { label: string; amount: number; confidence: "CONFIRMED" | "ESTIMATE" | "PROVIDER_CONFIRMATION"; source: string; note?: string }[]) || []}
                    />
                  </div>
                )}
                {m.payload?.tripCost && (
                  <div className="mt-2.5">
                    <BudgetTripCard
                      budget={m.payload.tripCost.total}
                      estimatedTotal={m.payload.tripCost.total}
                      delta={0}
                      possible={true}
                      confidence={m.payload.tripCost.confidence}
                      disclaimer={m.payload.tripCost.disclaimer as string}
                      distance={m.payload.tripCost.distance as unknown as { oneWayKm: number; totalKm: number; roundTrip: boolean; source: string } | undefined}
                      lines={(m.payload.tripCost.lines as unknown as { label: string; amount: number; confidence: "CONFIRMED" | "ESTIMATE" | "PROVIDER_CONFIRMATION"; source: string; note?: string }[]) || []}
                    />
                  </div>
                )}
                {m.payload?.needsLogin && (
                  <button
                    className="btn-primary mt-2.5 w-full !py-2"
                    onClick={() => window.dispatchEvent(new CustomEvent("nw:open-login"))}
                  >
                    Login to book
                  </button>
                )}
                {m.payload?.needsPayment && (
                  <PayInline payment={{ bookingId: m.payload.needsPayment.bookingId, amount: m.payload.needsPayment.amount }} />
                )}
                {m.role === "user" && <span className="mt-1 block text-right text-[10px] text-emerald-100">{time()}</span>}
              </div>
            ))}

            {phase === "THINKING" && msgs[msgs.length - 1]?.role === "user" && (
              <div className="chat-bubble-bot">
                <ProcessingSteps />
              </div>
            )}
          </div>

          {/* composer */}
          <form
            className="flex items-end gap-2 border-t border-slate-100 bg-white px-3 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            {speechSupported() && (
              <button
                type="button"
                onClick={toggleMic}
                aria-label={listening ? "Stop listening" : "Speak your need"}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition ${
                  listening ? "mic-live bg-red-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <IconMic className="h-5 w-5" />
              </button>
            )}
            <input
              className="input !py-3"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={listening ? "Listening…" : placeholder}
              aria-label="Tell Near Wheels what you need"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!input.trim() || phase === "THINKING"}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              <IconSend className="h-5 w-5" />
            </button>
          </form>
        </div>
      )}

      {/* booking straight from chat cards */}
      {bookingCard && <BookingSheet card={bookingCard} onClose={() => setBookingCard(null)} />}
    </>
  );
}

function time() {
  return new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1" aria-label="Assistant is typing">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </span>
  );
}

function ProcessingSteps() {
  const steps = ["Understanding your request…", "Finding nearby options…", "Comparing the best matches…"];
  return (
    <ol className="space-y-1 text-xs font-medium text-slate-500">
      {steps.map((s, i) => (
        <li key={s} className="anim-in" style={{ animationDelay: `${i * 250}ms` }}>
          {i === 0 ? " " : ""}
          {s}
        </li>
      ))}
    </ol>
  );
}

function PayInline({ payment }: { payment: { bookingId: string; amount: number } }) {
  const [state, setState] = useState<"IDLE" | "BUSY" | "DONE" | "FAILED">("IDLE");
  async function pay() {
    setState("BUSY");
    const c = await api<{ payment: { gatewayRef: string } }>("/api/payments", { json: { bookingId: payment.bookingId } });
    if (!c.ok) return setState("FAILED");
    const v = await api("/api/payments", { method: "PUT", json: { gatewayRef: c.data.payment.gatewayRef, outcome: "success" } });
    setState(v.ok && v.data.status === "SUCCESS" ? "DONE" : "FAILED");
    window.dispatchEvent(new Event("nw:bookings-updated"));
  }
  if (state === "DONE") return <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"> Payment successful — booking confirmed.</p>;
  return (
    <div className="mt-2.5">
      <button className="btn-accent w-full !py-2" onClick={pay} disabled={state === "BUSY"}>
        {state === "BUSY" ? "Processing…" : `Pay securely · ${inr(payment.amount)}`}
      </button>
      {state === "FAILED" && <p className="mt-1 text-xs text-red-600">Payment could not be completed. Please try again.</p>}
    </div>
  );
}
