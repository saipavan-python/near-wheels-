"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/ui";
import { Send, MessageCircle, Phone, User } from "lucide-react";

export default function BookingChat({ bookingId }: { bookingId: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [booking, setBooking] = useState<any>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setErr(null);
    const r = await api<{ booking: any; messages: any[] }>(`/api/bookings/${bookingId}/chat`);
    if (!r.ok) {
      setErr(r.data.error || "Cannot load chat");
      setLoading(false);
      return;
    }
    setBooking(r.data.booking);
    setMessages(r.data.messages || []);
    setLoading(false);
    setTimeout(() => listRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 100);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [bookingId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    const r = await api(`/api/bookings/${bookingId}/chat`, { json: { text } });
    setSending(false);
    if (!r.ok) return setErr(r.data.error || "Failed to send");
    setText("");
    load();
  };

  if (loading) return <div className="card p-6"><div className="skeleton h-32 w-full" /></div>;
  if (err) return <div className="card p-6"><p className="text-sm text-red-600">{err}</p><p className="mt-1 text-xs text-ink-mute">Chat is available after admin confirms the booking.</p></div>;
  if (!booking) return null;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b bg-ink px-4 py-3 text-white">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15"><MessageCircle className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">Chat — {booking.listingTitle}</p>
          <p className="truncate text-xs text-white/70">{booking.code} • {new Date(booking.scheduledFor || Date.now()).toLocaleDateString("en-IN")}</p>
        </div>
        <span className="rounded-full bg-emerald-500 px-2 py-1 text-xs font-bold">CONFIRMED</span>
      </div>

      <div ref={listRef} className="h-[320px] overflow-y-auto bg-paper p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="py-12 text-center">
            <MessageCircle className="mx-auto h-8 w-8 text-ink-faint" />
            <p className="mt-2 text-sm font-semibold">No messages yet</p>
            <p className="text-xs text-ink-mute">Say hello to coordinate pickup.</p>
          </div>
        ) : (
          messages.map((m: any) => (
            <div key={m.id} className={`flex ${m.isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.isMine ? "bg-brand-600 text-white rounded-br-sm" : "bg-white border border-ink/10 rounded-bl-sm"}`}>
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <p className={`mt-1 text-xs ${m.isMine ? "text-white/70" : "text-ink-faint"}`}>{new Date(m.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} {m.isMine ? "✓" : ""}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={send} className="flex gap-2 border-t bg-white p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="input h-11 flex-1"
          maxLength={1000}
        />
        <button type="submit" disabled={sending || !text.trim()} className="btn-primary !h-11 !px-5 disabled:opacity-50">
          <Send className="h-4 w-4" /> Send
        </button>
      </form>
    </div>
  );
}

export function ContactCard({ bookingId }: { bookingId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api(`/api/bookings/${bookingId}/contact`).then((r) => {
      setData(r.data);
      setLoading(false);
    });
  }, [bookingId]);

  if (loading) return <div className="skeleton h-20 w-full" />;
  if (!data?.allowed) {
    return (
      <div className="card border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">Contact hidden</p>
        <p className="text-xs text-amber-700">{data?.message || "Contact will be available after admin confirms."}</p>
        <p className="mt-1 text-xs text-ink-mute">Status: {data?.status}</p>
      </div>
    );
  }

  const isProvider = !!data.provider;
  return (
    <div className="card p-4">
      <h3 className="font-bold flex items-center gap-2">{isProvider ? <User className="h-4 w-4" /> : <Phone className="h-4 w-4" /> } {isProvider ? "Provider Contact" : "Customer Contact"}</h3>
      {isProvider ? (
        <div className="mt-3 space-y-1 text-sm">
          <p><span className="font-semibold">{data.provider.businessName}</span></p>
          <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-brand-600" /> <a href={`tel:${data.provider.phone}`} className="font-semibold text-brand-700 hover:underline">{data.provider.phone}</a> <a href={`tel:${data.provider.phone}`} className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white">Call Provider</a></p>
          {data.provider.addressText && <p className="text-xs text-ink-mute">{data.provider.addressText}</p>}
          <p className="text-xs text-ink-faint">Booking {data.bookingCode} • {data.status}</p>
        </div>
      ) : (
        <div className="mt-3 space-y-1 text-sm">
          <p className="font-semibold">{data.customer.name || "Customer"}</p>
          <p><a href={`tel:${data.customer.phone}`} className="font-semibold text-brand-700 hover:underline">{data.customer.phone}</a> {data.customer.email && <span className="ml-2 text-xs text-ink-mute">{data.customer.email}</span>}</p>
          <a href={`tel:${data.customer.phone}`} className="mt-2 inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-xs font-bold text-white">Call Customer</a>
        </div>
      )}
    </div>
  );
}
