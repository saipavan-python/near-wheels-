"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, CheckCircle2, XCircle, Clock, Phone, MapPin, UserCheck, RefreshCw } from "lucide-react";
import { api } from "@/lib/ui";

export default function ProviderBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadBookings = async () => {
    setLoading(true);
    const r = await fetch("/api/providers/me").then((res) => res.json());
    setLoading(false);
    if (r.ok) setBookings(r.data.bookings || []);
  };

  useEffect(() => {
    loadBookings();
  }, []);

  async function handleStatusChange(bookingId: string, action: "accept" | "reject") {
    setBusyId(bookingId);
    const r = await api<{ message: string }>("/api/providers/actions", {
      json: { action, bookingId },
    });
    setBusyId(null);
    if (r.ok) loadBookings();
  }

  const filtered = bookings.filter((b) => {
    if (activeTab === "PENDING") return ["REQUESTED", "PENDING_PROVIDER", "PENDING"].includes(b.status);
    if (activeTab === "ACTIVE") return ["ACCEPTED", "CONFIRMED", "EN_ROUTE", "IN_PROGRESS"].includes(b.status);
    if (activeTab === "COMPLETED") return b.status === "COMPLETED";
    if (activeTab === "CANCELLED") return b.status === "CANCELLED";
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Provider Bookings</h1>
          <p className="mt-1 text-xs text-ink-mute">
            Review incoming rental requests, accept orders, and manage trip progress.
          </p>
        </div>
        <button onClick={loadBookings} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh Orders
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto hide-scrollbar">
        {[
          { id: "ALL", label: "All Orders" },
          { id: "PENDING", label: "Pending Requests" },
          { id: "ACTIVE", label: "Active Trips" },
          { id: "COMPLETED", label: "Completed" },
          { id: "CANCELLED", label: "Cancelled" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-ink text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Booking List */}
      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-slate-400">Loading bookings…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 font-bold text-ink text-base">No bookings found</h3>
          <p className="mt-1 text-xs text-slate-500">Booking requests matching this filter will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((b) => {
            const isPending = ["REQUESTED", "PENDING_PROVIDER", "PENDING"].includes(b.status);
            const isConfirmed = ["ACCEPTED", "CONFIRMED", "EN_ROUTE", "IN_PROGRESS"].includes(b.status);

            return (
              <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <span className="font-mono font-extrabold text-brand-700">{b.code}</span>
                    <span className="ml-2 text-xs text-slate-400">• {new Date(b.createdAt).toLocaleDateString("en-IN")}</span>
                    <h3 className="font-bold text-ink text-base mt-0.5">{b.listingTitle || b.kind}</h3>
                  </div>

                  <div className="text-right">
                    <span className="font-display font-extrabold text-ink text-lg">₹{b.totalAmount}</span>
                    <p className={`text-xs font-bold uppercase tracking-wider ${isPending ? "text-amber-600" : isConfirmed ? "text-emerald-600" : "text-slate-500"}`}>
                      {b.status}
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div>
                    <span className="text-slate-400">Scheduled For:</span>{" "}
                    <span className="font-semibold text-slate-800">
                      {b.scheduledFor ? new Date(b.scheduledFor).toLocaleString("en-IN") : "Immediate / Today"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Duration / Scope:</span>{" "}
                    <span className="font-semibold text-slate-800">
                      {b.durationDays ? `${b.durationDays} Days` : b.acres ? `${b.acres} Acres` : "Standard Job"}
                    </span>
                  </div>
                </div>

                {/* Unlocked Customer Contact */}
                {isConfirmed && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs flex items-center justify-between">
                    <div>
                      <p className="font-bold text-emerald-900">Customer Contact Unlocked</p>
                      <p className="text-emerald-700">Phone: +91 {b.customerPhone || "Provided on call"}</p>
                    </div>
                    <Link href={`/provider/messages?bookingId=${b.id}`} className="btn-primary !py-1.5 !px-3 text-xs font-bold">
                      Open Chat
                    </Link>
                  </div>
                )}

                {/* Action buttons */}
                {isPending && (
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      disabled={busyId === b.id}
                      onClick={() => handleStatusChange(b.id, "reject")}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                    >
                      Decline Order
                    </button>
                    <button
                      disabled={busyId === b.id}
                      onClick={() => handleStatusChange(b.id, "accept")}
                      className="btn-primary !py-2 !px-5 text-xs font-bold shadow-md"
                    >
                      Accept Booking
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
