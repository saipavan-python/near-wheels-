import Link from "next/link";
import { ArrowUpRight, Bus, MapPin } from "lucide-react";

export default function YatraCta() {
  return (
    <section className="border-y border-amber-900/10 bg-[#fff8eb] py-14 md:py-20">
      <div className="container-nw grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-brand-700">
            <Bus className="h-4 w-4" /> Yatra Buses
          </div>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink md:text-5xl">
            Your journey. Your faith. Your wheels.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-ink-mute md:text-lg">
            Discover temple journeys and devotional bus packages from trusted local operators.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-ink-soft">
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-brand-600" /> Curated temple routes</span>
            <span className="inline-flex items-center gap-1.5"><Bus className="h-4 w-4 text-brand-600" /> Live seat availability</span>
          </div>
        </div>
        <Link href="/yatra-buses" className="btn-primary w-fit !rounded-xl !px-5 !py-3">
          Explore Yatra Buses <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}