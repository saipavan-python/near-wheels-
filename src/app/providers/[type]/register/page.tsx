import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CarFront, UserRound, Wrench, Tractor, Cpu, BadgeCheck, GraduationCap, Bus } from "lucide-react";
import RegisterForm from "@/components/RegisterForm";

const MAP: Record<
  string,
  { type: string; title: string; Icon: React.ComponentType<{ className?: string }>; blurb: string }
> = {
  vehicles: {
    type: "VEHICLE_OWNER",
    title: "List Your Vehicle",
    Icon: CarFront,
    blurb: "Rent out your car, auto, bike or truck when you're not using it. You set the price and availability.",
  },
  drivers: {
    type: "DRIVER",
    title: "Register as Driver",
    Icon: UserRound,
    blurb: "Get driving requests near you — on your schedule, for your own vehicle or the customer's.",
  },
  garages: {
    type: "GARAGE",
    title: "Register Your Garage or Wash Point",
    Icon: Wrench,
    blurb: "Reach customers who break down near you — mechanic visits, towing, battery, tyre work and water wash services.",
  },
  "farm-equipment": {
    type: "FARM",
    title: "List Farm Equipment",
    Icon: Tractor,
    blurb: "Tractors, harvesters and equipment idle between seasons? Rent them by the acre or day.",
  },
  drone: {
    type: "DRONE",
    title: "Register Drone Service",
    Icon: Cpu,
    blurb: "Offer precision spraying to farmers near you — per-acre bookings with clear schedules.",
  },
  "yatra-bus": {
    type: "YATRA",
    title: "Register Yatra Bus Service",
    Icon: Bus,
    blurb: "Offer temple yatra bus packages — fixed departures, temple stops, per-head pricing and live seat booking.",
  },
  "driving-school": {
    type: "DRIVING_SCHOOL",
    title: "Register Driving School",
    Icon: GraduationCap,
    blurb: "List your driving school, courses and instructors — students discover and book lessons near them.",
  },
};

export function generateStaticParams() {
  return Object.keys(MAP).map((t) => ({ type: t }));
}

export async function generateMetadata({ params }: { params: Promise<{  type: string  }> }): Promise<Metadata> {
  const cfg = MAP[(await params).type];
  return {
    title: cfg ? `${cfg.title} — Near Wheels` : "Provider registration — Near Wheels",
    description: cfg?.blurb,
  };
}

export default async function ProviderRegisterPage({ params }: { params: Promise<{  type: string  }> }) {
  const cfg = MAP[(await params).type];
  if (!cfg) notFound();
  // Driving school has its own multi-step form — keep single source of truth at /driving-school/register
  if ((await params).type === "driving-school") {
    redirect("/driving-school/register");
  }
  const { Icon } = cfg;
  return (
    <div className="container-nw max-w-xl py-10">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">For providers</p>
      <h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-extrabold tracking-tight">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-white">
          <Icon className="h-5 w-5" />
        </span>
        {cfg.title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-mute">{cfg.blurb}</p>
      <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-brand-50 px-3.5 py-2.5 text-xs font-medium text-brand-900">
        <BadgeCheck className="h-4 w-4 shrink-0" />
        Free to list · commission applies only on completed bookings · verification usually takes 1–2 days.
      </p>
      <div className="mt-6">
        <RegisterForm providerType={cfg.type} />
      </div>
    </div>
  );
}
