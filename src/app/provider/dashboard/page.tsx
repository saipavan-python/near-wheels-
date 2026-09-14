"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CarFront, Plus, Calendar, DollarSign, Star, TrendingUp, AlertTriangle, ShieldCheck, Search, Filter, RefreshCw, CheckCircle2, UserRound, Wrench, Bus, Tractor, Cpu, Power
} from "lucide-react";
import AssetCard, { AssetData } from "@/components/provider/AssetCard";

export default function ProviderDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [assets, setAssets] = useState<AssetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [availMsg, setAvailMsg] = useState<string | null>(null);

  // Filters for large fleet view
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  const loadData = async () => {
    setLoading(true);
    try {
      const [meRes, assetRes] = await Promise.all([
        fetch("/api/providers/me").then((r) => r.json()),
        fetch("/api/provider/assets").then((r) => r.json()),
      ]);

      if (meRes.ok) setData(meRes.data);
      if (assetRes.ok) setAssets(assetRes.data.assets || []);
      else setErr(assetRes.error || "Could not load assets");
    } catch (e: any) {
      setErr(e.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  const setProviderAvailability = async (status: string) => {
    setAvailabilityBusy(true);
    setAvailMsg(null);
    try {
      const r = await fetch("/api/providers/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_availability", availabilityStatus: status }),
      }).then((res) => res.json());
      if (!r.ok) { setAvailMsg(r.error || "Failed to update availability"); }
      else { setAvailMsg(`Availability set to ${status.replace("_", " ")}`); setData({ ...data, provider: { ...data?.provider, availabilityStatus: status } }); }
    } catch { setAvailMsg("Failed to update availability"); }
    finally { setAvailabilityBusy(false); setTimeout(() => setAvailMsg(null), 3000); }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-7 w-7 animate-spin rounded-full border-3 border-brand-600 border-t-transparent" />
          <p className="text-xs font-bold text-ink-mute">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  const provider = data?.provider;
  const bookings = data?.bookings || [];
  const earnings = data?.earnings || { gross: 0, net: 0 };
  const reviews = data?.reviews || [];

  // Filter logic for assets
  const filteredAssets = assets.filter((a) => {
    const matchesSearch =
      !searchQuery ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.make?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.registrationNumber?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCat = selectedCat === "ALL" || a.category.toUpperCase() === selectedCat.toUpperCase();
    const matchesStatus =
      selectedStatus === "ALL" ||
      (selectedStatus === "AVAILABLE" && (a.status === "ACTIVE" || a.status === "AVAILABLE")) ||
      a.status.toUpperCase() === selectedStatus.toUpperCase();

    return matchesSearch && matchesCat && matchesStatus;
  });

  const isLargeFleet = assets.length >= 10;
  const availableCount = assets.filter((a) => a.status === "ACTIVE" || a.status === "AVAILABLE").length;
  const bookedCount = assets.filter((a) => a.status === "BOOKED").length;
  const unavailableCount = assets.filter((a) => a.status === "NOT_AVAILABLE" || a.status === "MAINTENANCE").length;

  return (
    <div className="space-y-8">
      {/* Top Welcome Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-brand-100 bg-white p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="eyebrow text-brand-600">Provider Workspace</span>
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-700">
              Verified Business
            </span>
          </div>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            {provider?.businessName || "My Fleet Workspace"}
          </h1>
          <p className="mt-1 text-xs text-ink-mute">
            Managing {assets.length} {assets.length === 1 ? "asset" : "mixed assets"} • {provider?.addressText || "Base Location Configured"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <Link href="/provider/assets/add" className="btn-primary !py-2.5 !px-4 text-xs font-bold shadow-md">
            <Plus className="h-4 w-4" /> Add New Asset
          </Link>
        </div>
      </div>

      {/* Availability Toggle */}
      {provider && (
        <div className="card border-brand-100 bg-gradient-to-r from-brand-50 to-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-ink flex items-center gap-2">
                <Power className="h-4 w-4 text-brand-600" /> Profile Availability
              </h3>
              <p className="text-xs text-ink-mute mt-0.5">Control whether customers can see and book you</p>
            </div>
            <span className={`badge px-3 py-1.5 text-xs font-bold ${provider.availabilityStatus === "AVAILABLE_NOW" ? "bg-emerald-100 text-emerald-800" : provider.availabilityStatus === "BUSY" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
              {provider.availabilityStatus.replace("_", " ")}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { value: "AVAILABLE_NOW", label: "Available Now", desc: "Show in search", color: "emerald" },
              { value: "BUSY", label: "Busy", desc: "Personal use", color: "amber" },
              { value: "OFFLINE", label: "Offline", desc: "Not taking bookings", color: "red" },
              { value: "MAINTENANCE", label: "Maintenance", desc: "Under service", color: "purple" },
            ].map(({ value, label, desc }) => (
              <button
                key={value}
                disabled={availabilityBusy}
                onClick={() => setProviderAvailability(value)}
                className={`rounded-xl border py-2 px-3 text-xs font-bold transition ${provider.availabilityStatus === value ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-slate-200 bg-white hover:border-brand-300"}`}
              >
                {label}
                {provider.availabilityStatus === value && <CheckCircle2 className="h-3 w-3 inline ml-1 text-brand-600" />}
              </button>
            ))}
          </div>
          {availMsg && <p className="mt-2 text-xs font-bold text-brand-700">{availMsg}</p>}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Fleet Assets</span>
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-50 text-brand-600 font-bold">
              <CarFront className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-ink">{assets.length}</p>
          <p className="mt-1 text-[11px] font-semibold text-emerald-700">{availableCount} Available • {bookedCount} Booked</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Total Bookings</span>
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-sky-50 text-sky-600 font-bold">
              <Calendar className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-ink">{bookings.length}</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            {bookings.filter((b: any) => b.status === "COMPLETED").length} Completed Jobs
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Net Earnings</span>
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600 font-bold">
              <DollarSign className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-ink">₹{(earnings.net || earnings.gross || 0).toLocaleString("en-IN")}</p>
          <p className="mt-1 text-[11px] font-semibold text-emerald-700">Direct Payout Ready</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Provider Rating</span>
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-50 text-amber-600 font-bold">
              <Star className="h-4 w-4 fill-amber-400" />
            </span>
          </div>
          <p className="mt-2 font-display text-3xl font-extrabold text-ink">{provider?.ratingAvg || 4.8}</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">{provider?.ratingCount || 12} Customer Reviews</p>
        </div>
      </div>

      {/* Large Fleet Search & Filter Bar (Adaptive Layout) */}
      {isLargeFleet && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                className="input h-10 pl-9 text-xs"
                placeholder="Search asset title, make, model or reg number…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value)}
                className="input h-10 text-xs w-36"
              >
                <option value="ALL">All Categories</option>
                <option value="CAR">Cars</option>
                <option value="BIKE">Bikes</option>
                <option value="AUTO">Autos</option>
                <option value="TRUCK">Trucks</option>
                <option value="TRACTOR">Tractors</option>
                <option value="HARVESTER">Harvesters</option>
                <option value="EXCAVATOR">JCB / Construction</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="input h-10 text-xs w-36"
              >
                <option value="ALL">All Statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="BOOKED">Booked</option>
                <option value="NOT_AVAILABLE">Not Available</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Fleet Assets Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink">
            {isLargeFleet ? "Fleet Management" : "Your Assets & Listings"} ({filteredAssets.length})
          </h2>
          <Link href="/provider/assets" className="text-xs font-bold text-brand-700 hover:underline">
            View All Assets →
          </Link>
        </div>

        {filteredAssets.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <CarFront className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-3 font-bold text-ink text-base">No assets found</h3>
            <p className="mt-1 text-xs text-ink-mute">
              {searchQuery || selectedCat !== "ALL" ? "Try clearing search filters." : "Add your first car, tractor, bike or equipment."}
            </p>
            <Link href="/provider/assets/add" className="btn-primary mt-4 inline-flex !py-2.5 !px-5 text-xs font-bold">
              + Add First Asset
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAssets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} onStatusChange={loadData} />
            ))}
          </div>
        )}
      </div>

      {/* Bookings Overview Section */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h2 className="font-display text-lg font-bold text-ink">Recent Bookings</h2>
          <Link href="/provider/bookings" className="text-xs font-bold text-brand-700 hover:underline">
            Manage All Bookings →
          </Link>
        </div>

        {bookings.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink-mute">
            No customer booking requests yet. Once customer places an order, it appears here instantly.
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {bookings.slice(0, 5).map((b: any) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
                <div>
                  <span className="font-mono font-bold text-slate-800">{b.code}</span>
                  <p className="font-bold text-ink text-sm">{b.listingTitle || b.kind}</p>
                  <p className="text-slate-500">{new Date(b.createdAt).toLocaleDateString("en-IN")}</p>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-brand-700 text-sm">₹{b.totalAmount}</span>
                  <p className="font-bold text-slate-700 capitalize">{b.status.toLowerCase()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
