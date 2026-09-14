import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Star, BadgeCheck, MapPin, Users, Gauge, Fuel, Snowflake,
  KeyRound, ShieldCheck, FileText, Building2,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { findRuleForTarget, quoteFromRule } from "@/lib/services/pricingService";
import { vehicleGallery, vehicleImage } from "@/lib/imagery";
import BookingLauncher from "@/components/detail/BookingLauncher";
import type { ResultCard } from "@/lib/types";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { id: string } }) {
  const v = await prisma.vehicle.findUnique({ where: { id: params.id }, include: { provider: true } });
  if (!v) return { title: "Vehicle not found" };
  return {
    title: `${v.title} — Rent in ${v.provider.addressText || v.provider.businessName}`,
    description: `Book the ${v.title} (${v.seats} seats, ${v.transmission || "manual"}, ${v.fuelType || "fuel"}) on Near Wheels. Transparent daily pricing, verified owner, instant confirmation.`,
    openGraph: { images: [vehicleImage(v.title, v.category)] },
  };
}

export default async function VehicleDetail({ params }: { params: { id: string } }) {
  const v = await prisma.vehicle.findUnique({ where: { id: params.id }, include: { provider: true } });
  if (!v || v.status !== "ACTIVE") notFound();
  const p = v.provider;

  const rule = await findRuleForTarget(p.id, "VEHICLE", v.id);
  const dayQuote = quoteFromRule(rule, { days: 1 });
  const from = dayQuote?.total ?? null;

  const gallery = vehicleGallery(v.title, v.category);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const todayBlock = await prisma.vehicleAvailability.findFirst({
    where: { vehicleId: v.id, startDate: { lte: todayEnd }, endDate: { gte: todayStart } },
  });
  const isActive = v.status === "ACTIVE";
  const availableNow = p.availabilityStatus === "AVAILABLE_NOW" && isActive && !todayBlock;

  const card: ResultCard = {
    kind: "VEHICLE",
    id: v.id,
    providerId: p.id,
    title: v.title,
    subtitle: `${v.make} ${v.model}${v.year ? ` · ${v.year}` : ""}`,
    category: v.category,
    distanceKm: null,
    etaMin: null,
    availableNow,
    priceLabel: from != null ? `₹${Math.round(from).toLocaleString("en-IN")}/day` : "Ask for price",
    priceFrom: from,
    rating: p.ratingAvg,
    verified: p.isVerified,
    badges: [],
    emoji: "",
    meta: {
      seats: v.seats,
      transmission: v.transmission,
      fuel: v.fuelType,
      ac: v.ac,
      selfDrive: v.selfDriveAllowed,
      withDriver: v.withDriverAllowed,
    },
  };

  return (
    <div className="container-nw pt-6 md:pt-10">
      <Link href="/vehicles" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-mute transition hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> All vehicles
      </Link>

      {/* Gallery */}
      <div className="mt-5 grid gap-3 md:grid-cols-[2fr_1fr]">
        <img src={gallery[0]} alt={v.title} className="h-[300px] w-full rounded-3xl object-cover shadow-card md:h-[460px]" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
          {[gallery[1], gallery[2]].map((g, i) => (
            <img key={i} src={g} alt="" loading="lazy" className="hidden h-[calc(460px/2-6px)] w-full rounded-3xl object-cover shadow-card sm:block" />
          ))}
          <img src={gallery[3]} alt="" loading="lazy" className="h-[142px] w-full rounded-3xl object-cover shadow-card sm:hidden" />
        </div>
      </div>

      <div className="mt-8 grid gap-10 pb-16 lg:grid-cols-[1fr_400px] lg:gap-14">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{v.category}</p>
              <h1 className="section-title mt-1.5">{v.title}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-mute">
                <span className="flex items-center gap-1 font-semibold text-ink">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {p.ratingAvg > 0 ? `${p.ratingAvg.toFixed(1)} (${p.ratingCount})` : "New listing"}
                </span>
                {p.isVerified && (
                  <span className="flex items-center gap-1 text-emerald-700"><BadgeCheck className="h-4 w-4" /> Verified owner</span>
                )}
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {p.addressText || `${p.lat.toFixed(2)}, ${p.lng.toFixed(2)}`}</span>
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={`badge px-3 py-1.5 ${availableNow ? "bg-emerald-100 text-emerald-800" : todayBlock ? "bg-amber-100 text-amber-800" : "bg-paper-deep text-ink-mute"}`}>
                {todayBlock ? `Not Available Today` : availableNow ? "Available now" : "On schedule"}
              </span>
              {todayBlock && <span className="text-xs text-amber-700">Available again {new Date(todayBlock.endDate.getTime() + 86400000).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} • {todayBlock.reason}</span>}
              {!isActive && <span className="text-xs text-red-600">Vehicle status: {v.status} • Not bookable</span>}
            </div>
          </div>

          {/* Specs */}
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Spec Icon={Users} label="Seats" value={`${v.seats}`} />
            <Spec Icon={Gauge} label="Gearbox" value={(v.transmission || "Manual").toLowerCase()} />
            <Spec Icon={Fuel} label="Fuel" value={(v.fuelType || "—").toLowerCase()} />
            <Spec Icon={Snowflake} label="AC" value={v.ac ? "Yes" : "No"} />
          </div>

          <Section title="Rental options">
            <ul className="grid gap-2 text-sm text-ink-soft sm:grid-cols-2">
              <li className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-brand-600" /> Self-drive {v.selfDriveAllowed ? "available" : "not available"}</li>
              <li className="flex items-center gap-2"><Users className="h-4 w-4 text-brand-600" /> Driver-assisted {v.withDriverAllowed ? "available" : "not available"}</li>
            </ul>
          </Section>

          <Section title="Rental rules">
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-mute">
              <li>Valid driving licence required for self-drive rentals.</li>
              <li>No smoking inside the vehicle. Keep it clean for the next traveller.</li>
              <li>Late returns are charged per additional hour at the daily rate split.</li>
            </ul>
          </Section>

          <Section title="Cancellation & insurance">
            <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-mute">
              <li>Free cancellation until the provider accepts your request.</li>
              <li>After acceptance, cancellation fees may apply as shown at booking time.</li>
              <li>Every booking includes basic insurance coverage; details shared at confirmation.</li>
            </ul>
          </Section>

          <Section title="Owner">
            <div className="card flex items-center gap-4 p-4">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-white"><Building2 className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display font-bold">{p.businessName}</span>
                <span className="block text-xs text-ink-mute">
                  {p.completedJobs} completed trips{p.responseTimeSec ? ` · responds in ~${Math.max(1, Math.round(p.responseTimeSec / 60))} min` : ""}
                </span>
              </span>
              {p.isVerified && <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-600" />}
            </div>
          </Section>
        </div>

        {/* Booking panel */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6 shadow-lift">
            <div className="flex items-end justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-mute">From</span>
                <p className="font-display text-4xl font-extrabold tracking-tight">
                  {from != null ? `₹${Math.round(from).toLocaleString("en-IN")}` : "—"}
                  <span className="text-base font-semibold text-ink-mute">/day</span>
                </p>
              </div>
              <ShieldCheck className="h-8 w-8 text-brand-500" />
            </div>
            <p className="mt-1 text-xs text-ink-faint">Final price is confirmed by the platform before payment — no surprises.</p>
            <div className="mt-6">
              <BookingLauncher card={card} ctaLabel="Reserve Vehicle" />
            </div>
            <ul className="mt-5 space-y-2 border-t border-ink/[0.06] pt-4 text-xs text-ink-mute">
              <li className="flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> Instant confirmation after secure payment</li>
              <li className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5" /> Booking protection included</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Spec({ Icon, label, value }: { Icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink/[0.07] bg-white p-4">
      <Icon className="h-5 w-5 text-brand-600" />
      <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="text-sm font-bold capitalize">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
