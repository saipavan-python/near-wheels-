"use client";

import Link from "next/link";
import { ArrowUpRight, CarFront, UserRound, Wrench, Sparkles } from "lucide-react";
import { IMGS, vehicleImage, garageImage } from "@/lib/imagery";
import { LogoMark } from "../Logo";

const ACTIONS = [
  {
    href: "/vehicles",
    img: vehicleImage("rent-a-car", "SUV"),
    Icon: CarFront,
    title: "Rent a Car",
    desc: "Find the right vehicle for your journey.",
  },
  {
    href: "/drivers",
    img: IMGS.aiSide,
    Icon: UserRound,
    title: "Hire a Driver",
    desc: "Professional drivers when you need them.",
  },
  {
    href: "/garages",
    img: garageImage("find-garage"),
    Icon: Wrench,
    title: "Find a Garage",
    desc: "Trusted vehicle service near you.",
  },
  {
    href: "/share-my-ride",
    img: "/images/hero.jpg",
    Icon: CarFront,
    title: "Share My Ride",
    desc: "Your Wheels. Your Choice. Share empty seats.",
  },
];

export default function QuickActions() {
  return (
    <section className="container-nw pt-16 md:pt-20">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="card-lift group relative overflow-hidden rounded-3xl bg-ink text-white shadow-card"
          >
            <img src={a.img} alt="" className="h-44 w-full object-cover opacity-90 transition duration-500 group-hover:scale-[1.04]" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-5 pt-14">
              <span className="mb-2 inline-grid h-8 w-8 place-items-center rounded-lg bg-brand-500">
                <a.Icon className="h-4 w-4" />
              </span>
              <h3 className="font-display text-lg font-bold">{a.title}</h3>
              <p className="mt-0.5 text-xs text-white/65">{a.desc}</p>
            </div>
            <ArrowUpRight className="absolute right-4 top-4 h-5 w-5 text-white/70 transition duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-brand-400" />
          </Link>
        ))}

        <button
          onClick={() => window.dispatchEvent(new CustomEvent("nw:ai-ask", { detail: {} }))}
          className="card-lift group relative overflow-hidden rounded-3xl bg-ink text-left text-white shadow-card"
        >
          <img src="/images/assist-night.jpg" alt="" className="h-44 w-full object-cover opacity-45 transition duration-500 group-hover:scale-[1.04]" />
          {/* Near Wheels logo badge */}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex items-center gap-3 rounded-2xl bg-black/55 px-5 py-3 ring-1 ring-white/15 backdrop-blur-sm">
              <LogoMark size={40} />
              <span className="font-display text-base font-extrabold tracking-[0.14em]">
                NEAR<span className="text-brand-500">WHEELS</span>
                <span className="mt-0.5 block text-[10px] font-semibold tracking-[0.22em] text-white/60">AI ASSISTANCE</span>
              </span>
            </span>
          </span>
          <div className="absolute inset-x-0 bottom-0 p-5">
            <span className="mb-2 inline-grid h-8 w-8 place-items-center rounded-lg bg-brand-500">
              <Sparkles className="h-4 w-4" />
            </span>
            <h3 className="font-display text-lg font-bold">Get Assistance</h3>
            <p className="mt-0.5 text-xs text-white/65">Ask Near Wheels AI anything about your trip.</p>
          </div>
          <ArrowUpRight className="absolute right-4 top-4 h-5 w-5 text-white/70 transition duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-brand-400" />
        </button>
      </div>
    </section>
  );
}
