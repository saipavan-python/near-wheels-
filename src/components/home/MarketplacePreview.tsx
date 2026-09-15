"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { ResultCard } from "@/lib/ui";
import { api, inr } from "@/lib/ui";
import Reveal from "./Reveal";

export default function MarketplacePreview() {
  const [drivers, setDrivers] = useState<ResultCard[]>([]);
  const [garages, setGarages] = useState<ResultCard[]>([]);
  const [loaded, setLoaded] = useState({ drivers: false, garages: false });

  useEffect(() => {
    api<{ result: { items: ResultCard[] } }>("/api/search?type=drivers&lat=15.4771&lng=78.4807")
      .then((r) => setDrivers((r.data?.result?.items || []).slice(0, 3)))
      .finally(() => setLoaded((s) => ({ ...s, drivers: true })));
    api<{ result: { items: ResultCard[] } }>("/api/search?type=garages&lat=15.4771&lng=78.4807")
      .then((r) => setGarages((r.data?.result?.items || []).slice(0, 3)))
      .finally(() => setLoaded((s) => ({ ...s, garages: true })));
  }, []);

  return (
    <section className="container-nw pt-20 md:pt-28">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <Reveal>
          <div className="flex items-end justify-between">
            <div>
              <p className="eyebrow">Driver marketplace</p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight md:text-3xl">
                Need someone behind the wheel?
              </h2>
            </div>
            <Link href="/drivers" className="hidden items-center gap-1 text-sm font-semibold text-brand-700 hover:underline md:inline-flex">
              See all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 space-y-3">
            {drivers.length
              ? drivers.map((d: any) => (
                  <Row
                    key={d.id}
                    href="/drivers"
                    img={d.imageUrl || "/images/driver-profile.jpg"}
                    title={String(d.meta?.name || d.title)}
                    sub={`${d.rating > 0 ? ` ${d.rating.toFixed(1)} · ` : ""}${d.subtitle}`}
                    price={d.priceLabel}
                  />
                ))
              : loaded.drivers
              ? <EmptyState href="/providers/register" label="No drivers online yet — list your own vehicle or driver" cta="Become a provider" />
              : <Skeletons />}
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="flex items-end justify-between">
            <div>
              <p className="eyebrow">Service marketplace</p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight md:text-3xl">
                Keep your wheels running.
              </h2>
            </div>
            <Link href="/garages" className="hidden items-center gap-1 text-sm font-semibold text-brand-700 hover:underline md:inline-flex">
              See all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 space-y-3">
            {garages.length
              ? garages.map((g: any) => (
                  <Row
                    key={g.id}
                    href="/garages"
                    img={g.imageUrl || "/images/driver-profile.jpg"}
                    title={g.title}
                    sub={`${g.rating > 0 ? ` ${g.rating.toFixed(1)} · ` : ""}${g.subtitle}`}
                    price={g.priceLabel}
                  />
                ))
              : loaded.garages
              ? <EmptyState href="/providers/register" label="No services near you yet — be the first garage online" cta="Register your garage" />
              : <Skeletons />}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Skeletons() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="skeleton h-[72px] rounded-2xl" />
      ))}
    </>
  );
}

function EmptyState({ href, label, cta }: { href: string; label: string; cta: string }) {
  return (
    <Link
      href={href}
      className="card flex items-center justify-between gap-3 p-4 transition hover:border-brand-300"
    >
      <span className="text-sm font-medium text-ink-mute">{label}</span>
      <span className="shrink-0 text-sm font-bold text-brand-600">{cta}</span>
    </Link>
  );
}

function Row({
  href,
  img,
  title,
  sub,
  price,
}: {
  href: string;
  img: string;
  title: string;
  sub: string;
  price: string;
}) {
  return (
    <Link
      href={href}
      className="card group flex items-center gap-4 p-3 transition hover:border-brand-300"
    >
      <img src={img} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{title}</span>
        <span className="block truncate text-xs text-ink-mute">{sub}</span>
      </span>
      <span className="shrink-0 text-sm font-bold text-brand-600">{price}</span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-faint transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-600" />
    </Link>
  );
}
