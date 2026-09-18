import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowLeft, Star, BadgeCheck, MapPin, Clock, Wrench, Truck } from "lucide-react";
import { prisma } from "@/lib/db";
import { findRuleForTarget, quoteFromRule } from "@/lib/services/pricingService";
import { garageStatus } from "@/lib/services/garageHours";
import { garageImage } from "@/lib/imagery";
import BookingLauncher from "@/components/detail/BookingLauncher";
import type { ResultCard } from "@/lib/types";

export const revalidate = 60;

const getGarage = cache((id: string) =>
  prisma.garageProfile.findUnique({ where: { id }, include: { provider: true } })
);

const SERVICE_LABELS: Record<string, string> = {
  MECHANIC: "General service",
  TOWING: "Towing",
  BATTERY: "Battery",
  TYRE: "Tyre care",
  ELECTRICAL: "Electrical",
  AC_REPAIR: "AC repair",
  WATER_SERVICE: "Water wash & service point",
  BREAKDOWN: "Emergency breakdown",
  EMERGENCY: "Emergency response",
};

export async function generateMetadata({ params }: { params: { id: string } }) {
  const g = await getGarage(params.id);
  if (!g) return { title: "Garage not found" };
  return {
    title: `${g.provider.businessName} — Vehicle service & repair`,
    description: `Trusted garage in ${g.provider.addressText || "your area"}. ${g.open24x7 ? "Open 24×7." : `Open ${g.opensAt || "08:00"}–${g.closesAt || "20:00"}.`} Verified mechanics, transparent pricing on Near Wheels.`,
    openGraph: { images: [garageImage(g.id)] },
    alternates: { canonical: `/garages/${params.id}` },
  };
}

export default async function GarageDetail({ params }: { params: { id: string } }) {
  const prof = await getGarage(params.id);
  if (!prof || prof.provider.status !== "ACTIVE") notFound();
  const p = prof.provider;

  let services: string[] = [];
  try { services = JSON.parse(prof.services); } catch {}

  const rule = await findRuleForTarget(p.id, "GARAGE", prof.id);
  const visitQuote = quoteFromRule(rule, {});
  const from = visitQuote?.total ?? null;
  const st = garageStatus(prof, p);

  const card: ResultCard = {
    kind: "GARAGE",
    id: prof.id,
    providerId: p.id,
    title: p.businessName,
    subtitle: services.length ? `${services.length} services · ${p.addressText || "nearby"}` : p.addressText || "",
    category: "GARAGE_SERVICE",
    distanceKm: null,
    etaMin: null,
    availableNow: st.open,
    priceLabel: from != null ? `from ₹${Math.round(from).toLocaleString("en-IN")}` : "Ask for price",
    priceFrom: from,
    rating: p.ratingAvg,
    verified: p.isVerified,
    badges: [],
    emoji: "",
    meta: {},
  };

  return (
    <div className="container-nw pt-6 md:pt-10">
      <Link href="/garages" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-mute transition hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> All garages
      </Link>

      <img
        src={garageImage(p.id)}
        alt={p.businessName}
        fetchPriority="high"
        className="mt-5 h-[280px] w-full rounded-[2rem] object-cover shadow-card md:h-[380px]"
      />

      <div className="mt-8 grid gap-10 pb-16 lg:grid-cols-[1fr_400px] lg:gap-14">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="section-title">{p.businessName}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-mute">
                <span className="flex items-center gap-1 font-semibold text-ink">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {p.ratingAvg > 0 ? `${p.ratingAvg.toFixed(1)} (${p.ratingCount})` : "New"}
                </span>
                {p.isVerified && (
                  <span className="flex items-center gap-1 text-emerald-700"><BadgeCheck className="h-4 w-4" /> Verified garage</span>
                )}
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {p.addressText || `${p.lat.toFixed(2)}, ${p.lng.toFixed(2)}`}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge px-3 py-1.5 ${st.open ? "bg-emerald-500 text-white" : "bg-paper-deep text-ink-mute"}`}>
                <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${st.open ? "bg-white" : "bg-ink-mute"}`} />
                {st.open ? (st.label === "24×7" ? "Open 24×7" : "Open now") : st.detail}
              </span>
              {st.emergency && <span className="badge bg-red-50 px-3 py-1.5 text-red-600">⚡ Emergency response available</span>}
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Fact Icon={Clock} title="Hours" value={prof.open24x7 ? "24 × 7" : `${prof.opensAt || "08:00"} – ${prof.closesAt || "20:00"}`} />
            <Fact Icon={Wrench} title="Services" value={`${Math.max(services.length, 1)} offered`} />
            <Fact Icon={Truck} title="Pickup & drop" value={prof.pickupDrop ? "Available" : "At garage only"} />
          </div>

          <section className="mt-9">
            <h2 className="font-display text-xl font-bold tracking-tight">Services</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(services.length ? services : ["MECHANIC"]).map((s) => (
                <span key={s} className="rounded-full border border-ink/10 bg-white px-4 py-2 text-sm font-semibold capitalize text-ink-soft shadow-sm">
                  {SERVICE_LABELS[s] || s.toLowerCase().replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </section>

          <section className="mt-9">
            <h2 className="font-display text-xl font-bold tracking-tight">About</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-mute">
              {p.about || `${p.businessName} is a verified service partner serving customers around ${p.addressText || "the area"}${p.completedJobs ? `, with ${p.completedJobs} completed jobs on the platform` : ""}. Book an appointment and the final quote is always confirmed before any work starts.`}
            </p>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6 shadow-lift">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-mute">Visit / inspection</span>
            <p className="font-display text-4xl font-extrabold tracking-tight">
              {from != null ? `₹${Math.round(from).toLocaleString("en-IN")}` : "—"}
              <span className="text-base font-semibold text-ink-mute"> onwards</span>
            </p>
            <div className="mt-6">
              <BookingLauncher card={card} ctaLabel="Book Service" />
            </div>
            <ul className="mt-5 space-y-2 border-t border-ink/[0.06] pt-4 text-xs text-ink-mute">
              <li>Choose a slot that works for you at booking.</li>
              <li>Repairs above estimate always need your approval first.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Fact({ Icon, title, value }: { Icon: any; title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink/[0.07] bg-white p-4">
      <Icon className="h-5 w-5 text-brand-600" />
      <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{title}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}
