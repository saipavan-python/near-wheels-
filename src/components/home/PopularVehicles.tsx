"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Heart, Star, Users, Fuel, Gauge } from "lucide-react";
import type { ResultCard } from "@/lib/ui";
import { api, STATUS_META } from "@/lib/ui";
import Reveal from "./Reveal";
import { vehicleImage } from "@/lib/imagery";

const DEFAULT_CENTER = { lat: 15.4771, lng: 78.4807 }; // Nandyal

function readFavs(): string[] {
  try {
    return JSON.parse(localStorage.getItem("nw_favs") || "[]");
  } catch {
    return [];
  }
}

export default function PopularVehicles() {
  const [items, setItems] = useState<ResultCard[] | null>(null);
  const [favs, setFavs] = useState<string[]>([]);

  useEffect(() => {
    setFavs(readFavs());
    api<{ result: { items: ResultCard[] } }>(
      `/api/search?type=vehicles&lat=${DEFAULT_CENTER.lat}&lng=${DEFAULT_CENTER.lng}&sortBy=BEST_MATCH`
    ).then((r) => setItems(r.data?.result?.items?.slice(0, 10) || []));
  }, []);

  function toggleFav(id: string) {
    const next = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
    setFavs(next);
    try {
      localStorage.setItem("nw_favs", JSON.stringify(next));
    } catch {}
  }

  return (
    <section className="container-nw pt-20 md:pt-28">
      <Reveal className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Vehicle discovery</p>
          <h2 className="section-title mt-2">Find your perfect ride.</h2>
          <p className="mt-2 text-sm text-ink-mute">From everyday city drives to premium weekend escapes.</p>
        </div>
        <Link href="/vehicles" className="group hidden items-center gap-1.5 text-sm font-semibold text-ink transition hover:text-brand-700 md:inline-flex">
          View all
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </Link>
      </Reveal>

      <div className="mt-8 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-3 hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
        {(items === null ? Array.from({ length: 4 }) : items).map((v: any, i: number) =>
          v === undefined ? (
            <div key={i} className="w-[300px] shrink-0 snap-start">
              <div className="skeleton h-44 w-full rounded-t-3xl" />
              <div className="skeleton h-32 w-full rounded-b-3xl" />
            </div>
          ) : (
            <article key={v.id} className="card-lift group w-[300px] shrink-0 snap-start overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-black/[0.04]">
              <div className="relative overflow-hidden">
<img
                   src={v.imageUrl || vehicleImage(v.title, v.category)}
                   alt={v.title}
                   loading={i < 3 ? "eager" : "lazy"}
                   className="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                 />
                <button
                  onClick={() => toggleFav(v.id)}
                  aria-label="Save to favorites"
                  className={`absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full backdrop-blur-md transition ${
                    favs.includes(v.id) ? "bg-brand-500 text-white" : "bg-white/80 text-ink hover:bg-white"
                  }`}
                >
                  <Heart className={`h-4 w-4 ${favs.includes(v.id) ? "fill-current" : ""}`} />
                </button>
                <span className={`absolute left-3 top-3 ${statusPill(v.availableNow)}`}>
                  {v.availableNow ? "Available now" : "On schedule"}
                </span>
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-bold leading-snug">{v.title}</h3>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-paper px-2 py-0.5 text-xs font-bold">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {v.rating > 0 ? v.rating.toFixed(1) : "New"}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-ink-mute">{v.subtitle}</p>

                <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[11px] font-medium text-ink-mute">
                  {v.meta.seats ? (
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-brand-600" />{v.meta.seats} seats</span>
                  ) : null}
                  {v.meta.transmission ? (
                    <span className="inline-flex items-center gap-1"><Gauge className="h-3.5 w-3.5 text-brand-600" />{String(v.meta.transmission).toLowerCase()}</span>
                  ) : null}
                  {v.meta.fuel ? (
                    <span className="inline-flex items-center gap-1"><Fuel className="h-3.5 w-3.5 text-brand-600" />{String(v.meta.fuel).toLowerCase()}</span>
                  ) : null}
                  {v.distanceKm != null && <span>· {v.distanceKm} km away</span>}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-ink/[0.06] pt-4">
                  <span className="text-sm font-bold text-brand-600">{v.priceLabel}</span>
                  <Link href={`/vehicles/${v.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-ink transition group-hover:text-brand-700">
                    View Details
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            </article>
          )
        )}
      </div>
    </section>
  );
}

function statusPill(availableNow: boolean): string {
  return availableNow
    ? "badge bg-emerald-500/95 text-white shadow-sm"
    : "badge bg-black/45 text-white backdrop-blur-sm";
}
