"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Filter, RefreshCw, CarFront, Tractor, Cpu, Wrench, UserRound } from "lucide-react";
import AssetCard, { AssetData } from "@/components/provider/AssetCard";

export default function ProviderAssetsPage() {
  const [assets, setAssets] = useState<AssetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("ALL");

  const loadAssets = async () => {
    setLoading(true);
    const r = await fetch("/api/provider/assets").then((res) => res.json());
    setLoading(false);
    if (r.ok) setAssets(r.data.assets || []);
  };

  useEffect(() => {
    loadAssets();
  }, []);

  const filtered = assets.filter((a) => {
    const matchesSearch =
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.make?.toLowerCase().includes(search.toLowerCase()) ||
      a.registrationNumber?.toLowerCase().includes(search.toLowerCase());

    const cat = a.category.toUpperCase();
    let matchesTab = true;
    if (activeTab === "VEHICLES") matchesTab = ["CAR", "BIKE", "AUTO", "TRUCK", "VAN", "SUV"].includes(cat);
    else if (activeTab === "EQUIPMENT") matchesTab = ["TRACTOR", "HARVESTER", "EXCAVATOR", "AGRI"].includes(cat);
    else if (activeTab !== "ALL") matchesTab = cat === activeTab;

    return matchesSearch && matchesTab;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Assets & Vehicles</h1>
          <p className="mt-1 text-xs text-ink-mute">
            Manage your vehicles, tractors, machinery, and equipment listings across all categories.
          </p>
        </div>
        <Link href="/provider/assets/add" className="btn-primary !py-2.5 !px-5 text-xs font-bold shadow-md">
          <Plus className="h-4 w-4" /> Add Asset
        </Link>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex gap-1 overflow-x-auto hide-scrollbar">
          {[
            { id: "ALL", label: "All Assets" },
            { id: "VEHICLES", label: "Road Vehicles" },
            { id: "EQUIPMENT", label: "Farm & Construction" },
            { id: "CAR", label: "Cars" },
            { id: "TRACTOR", label: "Tractors" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className="input h-9 pl-9 text-xs"
            placeholder="Search assets…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-ink-mute">Loading assets…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <CarFront className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 font-bold text-ink text-base">No assets found</h3>
          <p className="mt-1 text-xs text-ink-mute">Try adjusting your filters or add a new vehicle or machine.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((asset) => (
            <AssetCard key={asset.id} asset={asset} onStatusChange={loadAssets} />
          ))}
        </div>
      )}
    </div>
  );
}
