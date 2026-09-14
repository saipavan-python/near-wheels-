"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CarFront, Bike, Truck, Bus, Tractor, Cpu, Wrench, UserRound, Clock, ShieldCheck, Settings, Calendar, AlertTriangle, CheckCircle2, Power, Eye, Trash2
} from "lucide-react";
import { api } from "@/lib/ui";

export interface AssetData {
  id: string;
  kind: string;
  category: string;
  title: string;
  make?: string;
  model?: string;
  status: string;
  seats?: number;
  fuelType?: string;
  transmission?: string;
  ac?: boolean | null;
  registrationNumber?: string | null;
  hp?: number | null;
  capacityAcresPerDay?: number | null;
  specs?: Record<string, any>;
  pricing?: {
    dailyRate?: number | null;
    perKm?: number | null;
    perAcre?: number | null;
    hourlyRate?: number | null;
  } | null;
  availabilities?: Array<{ id: string; status: string; reason?: string; startDate: string; endDate: string }>;
}

export default function AssetCard({
  asset,
  onStatusChange,
}: {
  asset: AssetData;
  onStatusChange?: () => void;
}) {
  const router = useRouter();
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(asset.status);

  const cat = asset.category.toUpperCase();
  
  // Icon resolution
  const Icon = cat.includes("CAR") || cat.includes("SUV")
    ? CarFront
    : cat.includes("BIKE") || cat.includes("SCOOTER")
    ? Bike
    : cat.includes("AUTO")
    ? CarFront
    : cat.includes("TRUCK") || cat.includes("PICKUP")
    ? Truck
    : cat.includes("VAN") || cat.includes("TRAVELLER") || cat.includes("BUS")
    ? Bus
    : cat.includes("TRACTOR") || cat.includes("HARVESTER")
    ? Tractor
    : cat.includes("JCB") || cat.includes("EXCAVATOR") || cat.includes("CONSTRUCTION")
    ? Cpu
    : cat.includes("GARAGE")
    ? Wrench
    : cat.includes("DRIVER")
    ? UserRound
    : CarFront;

  // Status color badge
  const statusBadge =
    currentStatus === "ACTIVE" || currentStatus === "AVAILABLE"
      ? { label: "Available Now", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" }
      : currentStatus === "BOOKED"
      ? { label: "Booked", cls: "bg-amber-50 text-amber-800 border-amber-200" }
      : currentStatus === "MAINTENANCE"
      ? { label: "Maintenance", cls: "bg-purple-50 text-purple-800 border-purple-200" }
      : currentStatus === "NOT_AVAILABLE"
      ? { label: "Not Available", cls: "bg-rose-50 text-rose-800 border-rose-200" }
      : { label: currentStatus, cls: "bg-slate-100 text-slate-700 border-slate-200" };

  async function toggleUnavailableToday() {
    setToggling(true);
    const nextStatus = currentStatus === "ACTIVE" || currentStatus === "AVAILABLE" ? "NOT_AVAILABLE" : "ACTIVE";
    const r = await api<{ message: string }>(`/api/provider/assets/${asset.id}`, {
      method: "PATCH",
      json: { status: nextStatus },
    });
    setToggling(false);
    if (r.ok) {
      setCurrentStatus(nextStatus);
      onStatusChange?.();
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this asset? This cannot be undone.")) return;
    setDeleting(true);
    const r = await api<{ message: string }>(`/api/provider/assets/${asset.id}`, { method: "DELETE" });
    setDeleting(false);
    if (r.ok) {
      router.push("/provider/assets");
    }
  }

  const p = asset.pricing;
  const rateText = p?.dailyRate
    ? `₹${p.dailyRate}/day`
    : p?.perAcre
    ? `₹${p.perAcre}/acre`
    : p?.hourlyRate
    ? `₹${p.hourlyRate}/hr`
    : p?.perKm
    ? `₹${p.perKm}/km`
    : "Custom Rate";

  const specs = asset.specs || {};

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-ink/10 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md">
      <div>
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink/5 text-ink transition group-hover:bg-brand-600 group-hover:text-white">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-ink-faint">{asset.category}</span>
              <h3 className="font-bold text-ink leading-tight text-base">{asset.title}</h3>
              {asset.registrationNumber && (
                <p className="text-xs font-mono text-ink-mute uppercase">{asset.registrationNumber}</p>
              )}
            </div>
          </div>

          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadge.cls}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {statusBadge.label}
          </span>
        </div>

        {/* Specs highlights grid */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-paper/60 p-3 text-xs">
          {asset.seats ? (
            <div>
              <span className="text-ink-faint">Seats:</span> <span className="font-semibold text-ink">{asset.seats} Seater</span>
            </div>
          ) : null}

          {asset.fuelType ? (
            <div>
              <span className="text-ink-faint">Fuel:</span> <span className="font-semibold text-ink capitalize">{asset.fuelType.toLowerCase()}</span>
            </div>
          ) : null}

          {asset.hp || specs.horsepower ? (
            <div>
              <span className="text-ink-faint">Power:</span> <span className="font-semibold text-ink">{asset.hp || specs.horsepower} HP</span>
            </div>
          ) : null}

          {specs.engineHours || specs.operatingHours ? (
            <div>
              <span className="text-ink-faint">Hours:</span> <span className="font-semibold text-ink">{specs.engineHours || specs.operatingHours} hrs</span>
            </div>
          ) : null}

          {specs.bucketCapacity ? (
            <div>
              <span className="text-ink-faint">Bucket:</span> <span className="font-semibold text-ink">{specs.bucketCapacity}</span>
            </div>
          ) : null}

          {asset.transmission ? (
            <div>
              <span className="text-ink-faint">Trans:</span> <span className="font-semibold text-ink capitalize">{asset.transmission.toLowerCase()}</span>
            </div>
          ) : null}

          <div>
            <span className="text-ink-faint">Rate:</span> <span className="font-extrabold text-brand-700">{rateText}</span>
          </div>
        </div>
      </div>

      {/* Action buttons footer */}
      <div className="mt-5 flex items-center justify-between gap-2 border-t border-ink/5 pt-3">
        <button
          type="button"
          disabled={toggling}
          onClick={toggleUnavailableToday}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition ${
            currentStatus === "NOT_AVAILABLE"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              : "border-rose-200 bg-rose-50/50 text-rose-700 hover:bg-rose-100"
          }`}
        >
          <Power className="h-3.5 w-3.5" />
          {currentStatus === "NOT_AVAILABLE" ? "Mark Available" : "Not Available Today"}
        </button>

        <Link
          href={`/provider/assets/${asset.id}`}
          className="inline-flex items-center gap-1 rounded-xl border border-ink/15 bg-white px-3 py-2 text-xs font-bold text-ink transition hover:border-brand-500 hover:text-brand-700"
        >
          <Settings className="h-3.5 w-3.5" /> Manage
        </Link>
        <button
          type="button"
          disabled={deleting}
          onClick={handleDelete}
          className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
        >
          <Trash2 className="h-3.5 w-3.5" /> {deleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}
