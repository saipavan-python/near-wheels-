"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Reveal from "./Reveal";
import { IMGS } from "@/lib/imagery";

const STEPS = [
  { n: "01", title: "Search", desc: "Find vehicles, drivers or garages near you." },
  { n: "02", title: "Compare", desc: "Compare pricing, ratings and availability." },
  { n: "03", title: "Book", desc: "Reserve everything from one platform." },
  { n: "04", title: "Move", desc: "Enjoy your journey — we handle the rest." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="container-nw pt-20 md:pt-28">
      <Reveal className="max-w-2xl">
        <p className="eyebrow">How it works</p>
        <h2 className="section-title mt-2">Four steps to moving better.</h2>
      </Reveal>
      <div className="relative mt-12 grid gap-10 md:grid-cols-4 md:gap-6">
        <div aria-hidden className="absolute left-0 right-0 top-[26px] hidden border-t border-dashed border-ink/20 md:block" />
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.09}>
            <div className="relative">
              <span className="relative z-10 grid h-[52px] w-[52px] place-items-center rounded-full bg-ink font-display text-sm font-extrabold text-white">
                {s.n}
              </span>
              <h3 className="mt-4 font-display text-xl font-bold">{s.title}</h3>
              <p className="mt-1.5 max-w-[240px] text-sm leading-relaxed text-ink-mute">{s.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function BigCta() {
  return (
    <section className="container-nw mt-24 md:mt-32">
      <Reveal>
        <div className="relative overflow-hidden rounded-[2rem] bg-ink text-white shadow-lift">
          <img src={IMGS.cta} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-45" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/40" />
          <div className="relative px-6 py-24 text-center md:py-32">
            <h2 className="mx-auto max-w-2xl font-display text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
              Where will your wheels take you<span className="text-brand-500">?</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm text-white/70 md:text-base">
              Find your next vehicle, driver or service with Near Wheels.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link href="/vehicles" className="btn-primary !rounded-full !px-7 !py-3.5">
                Explore Vehicles <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("nw:ai-ask", { detail: {} }))}
                className="btn-ghost-light !rounded-full !px-7 !py-3.5"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
