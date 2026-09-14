import Link from "next/link";
import { ArrowRight } from "lucide-react";
import HeroImage from "./HeroImage";

export default function Hero() {
  return (
    <section className="relative flex min-h-[60vh] items-end overflow-hidden bg-ink text-white md:min-h-[75vh]">
      <HeroImage />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/55" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />

      <div className="container-nw relative pb-24 pt-32 md:pb-28">
        <p className="anim-in font-display text-xs font-bold uppercase tracking-[0.34em] text-white/75">
          Near Wheels
        </p>
        <h1
          className="anim-in mt-4 max-w-3xl font-display text-5xl font-extrabold leading-[1.02] tracking-tight md:text-7xl"
          style={{ animationDelay: "80ms" }}
        >
          Your journey.
          <br />
          Your wheels<span className="text-brand-500">.</span>
        </h1>
        <p
          className="anim-in mt-5 max-w-xl text-base font-semibold leading-relaxed text-brand-400 md:text-lg"
          style={{ animationDelay: "160ms" }}
        >
          Rent a car, book a driver, or find trusted vehicle services — all in one place.
        </p>
        <blockquote
          className="anim-in mt-6 max-w-xl rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur sm:p-5"
          style={{ animationDelay: "200ms" }}
        >
          <p className="font-display text-lg font-bold leading-snug text-white sm:text-xl">“Your journey. Your wheels.”</p>
          <p className="mt-2 text-sm leading-relaxed text-white/70">Nearby, fast, reliable — find or provide mobility in minutes. The quotation from our old code, now premium with Pro Max hierarchy and motion.</p>
        </blockquote>
        <div
          className="anim-in mt-8 flex flex-wrap items-center gap-3"
          style={{ animationDelay: "240ms" }}
        >
          <Link href="/vehicles" className="btn-primary !rounded-full !px-6 !py-3">
            Explore Vehicles <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/drivers" className="btn-ghost-light !rounded-full !px-6 !py-3">
            Find a Driver
          </Link>
        </div>
      </div>
    </section>
  );
}
