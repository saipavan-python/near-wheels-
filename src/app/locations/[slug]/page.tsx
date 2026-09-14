import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, BadgeCheck, Users, Wrench, CarFront, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { vehicleImage, garageImage, portraitImage } from "@/lib/imagery";
import { haversineKm } from "@/lib/geo";
import { siteUrl } from "@/lib/seo";

export const revalidate = 3600;

const CITIES = {
  kurnool: { name: "Kurnool", lat: 15.8281, lng: 78.0373, radiusKm: 60 },
  nandyal: { name: "Nandyal", lat: 15.4771, lng: 78.4807, radiusKm: 60 },
} as const;

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(CITIES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const cfg = CITIES[params.slug as keyof typeof CITIES];
  if (!cfg) return {};
  return {
    title: `Cars, Bikes & Garages in ${cfg.name} | Near Wheels`,
    description: `Rent cars, autos, bikes and pickups, hire verified drivers and find trusted garages in ${cfg.name} — book in minutes on Near Wheels.`,
    alternates: { canonical: `/locations/${params.slug}` },
  };
}

export default async function LocationPage({ params }: { params: { slug: string } }) {
  const cfg = CITIES[params.slug as keyof typeof CITIES];
  if (!cfg) notFound();

  const [providers, vehicles, garages, drivers] = await Promise.all([
    prisma.provider.findMany({ where: { status: "ACTIVE" } }),
    prisma.vehicle.findMany({
      where: { status: "ACTIVE" },
      include: { provider: true },
    }),
    prisma.garageProfile.findMany({
      where: { provider: { status: "ACTIVE" } },
      include: { provider: true },
    }),
    prisma.driverProfile.findMany({
      where: { provider: { status: "ACTIVE" } },
      include: { provider: true },
    }),
  ]);

  const near = (lat: number, lng: number) => haversineKm(lat, lng, cfg.lat, cfg.lng) <= cfg.radiusKm;

  const nearProviders = providers.filter((x) => near(x.lat, x.lng));
  const nearVehicles = vehicles.filter((v) => near(v.provider.lat, v.provider.lng));
  const nearGarages = garages.filter((g) => near(g.provider.lat, g.provider.lng));
  const nearDrivers = drivers.filter((d) => near(d.provider.lat, d.provider.lng));

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: cfg.name },
    ],
  };

  return (
    <div className="container-nw py-10 md:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <p className="eyebrow">Near Wheels · {cfg.name}</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-ink">
        Vehicle rental, drivers & garages in {cfg.name}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-mute">
        Rent self-drive cars, autos, bikes, pickups and trucks in and around {cfg.name}, hire a
        professional driver for your own vehicle, or get help from a verified garage. Every listing
        below is live and bookable on Near Wheels.
      </p>

      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<CarFront className="h-5 w-5" />} label="Vehicles available" value={nearVehicles.length} href="/vehicles" />
        <StatCard icon={<Users className="h-5 w-5" />} label="Verified drivers" value={nearDrivers.length} href="/drivers" />
        <StatCard icon={<Wrench className="h-5 w-5" />} label="Garages & repair" value={nearGarages.length} href="/garages" />
        <StatCard icon={<Star className="h-5 w-5" />} label="Active providers" value={nearProviders.length} href="/farm-services" />
      </div>

      {nearVehicles.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-ink">Vehicles in {cfg.name}</h2>
            <Link href="/vehicles" className="link text-sm font-semibold">View all vehicles <ArrowRight className="inline h-4 w-4" /></Link>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nearVehicles.slice(0, 6).map((v) => (
              <Link key={v.id} href={`/vehicles/${v.id}`} className="card overflow-hidden p-0 transition hover:shadow-lift">
                <img src={vehicleImage(v.title, v.category)} alt={v.title} className="h-44 w-full object-cover" loading="lazy" />
                <div className="p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-brand-600">{v.category}</p>
                  <p className="mt-1 font-display font-bold text-ink">{v.title}</p>
                  <p className="mt-1 text-xs text-ink-mute">{v.provider.businessName}{v.provider.isVerified && <BadgeCheck className="ml-1 inline h-3.5 w-3.5 text-emerald-600" />}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {nearGarages.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-ink">Garages & repair in {cfg.name}</h2>
            <Link href="/garages" className="link text-sm font-semibold">All garages <ArrowRight className="inline h-4 w-4" /></Link>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nearGarages.slice(0, 6).map((g) => (
              <Link key={g.id} href={`/garages/${g.id}`} className="card p-4 transition hover:shadow-lift">
                <div className="flex items-center gap-3">
                  <img src={garageImage(g.id)} alt="" className="h-14 w-14 rounded-2xl object-cover" loading="lazy" />
                  <div className="min-w-0">
                    <p className="truncate font-display font-bold text-ink">{g.provider.businessName}</p>
                    <p className="truncate text-xs text-ink-mute">{g.provider.addressText}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-ink-soft">
                      {g.open24x7 ? "Open 24×7" : `Open ${g.opensAt || "08:00"}–${g.closesAt || "20:00"}`}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {nearDrivers.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-ink">Drivers in {cfg.name}</h2>
            <Link href="/drivers" className="link text-sm font-semibold">All drivers <ArrowRight className="inline h-4 w-4" /></Link>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nearDrivers.slice(0, 6).map((d) => (
              <Link
                key={d.id}
                href={`/drivers/${d.id}`}
                className="card flex items-center gap-4 p-4 transition hover:shadow-lift"
              >
                <img src={portraitImage(d.provider.businessName)} alt="" className="h-14 w-14 rounded-2xl object-cover" loading="lazy" />
                <div className="min-w-0">
                  <p className="truncate font-display font-bold text-ink">{d.provider.businessName}</p>
                  <p className="truncate text-xs text-ink-mute">{d.provider.completedJobs} completed trips</p>
                  {d.provider.ratingAvg > 0 && <p className="mt-0.5 text-xs font-semibold text-ink"><Star className="mr-1 inline h-3.5 w-3.5 fill-amber-400 text-amber-400" />{d.provider.ratingAvg.toFixed(1)} ({d.provider.ratingCount})</p>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="mt-12 text-sm leading-relaxed text-ink-mute">
        Don&apos;t see what you need in {cfg.name}? Ask the <Link href="/#ai" className="link font-semibold">Near Wheels AI</Link> what&apos;s
        available near you, or pick a service: <Link href="/farm-services" className="link">farm equipment</Link>,{" "}
        <Link href="/drone-spraying" className="link">drone spraying</Link> or{" "}
        <Link href="/emergency" className="link">24×7 emergency help</Link>.
      </p>
    </div>
  );
}

function StatCard({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: number; href: string }) {
  return (
    <Link href={href} className="card flex items-center gap-4 p-5 transition hover:shadow-lift">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">{icon}</span>
      <span>
        <span className="block font-display text-2xl font-extrabold leading-none text-ink">{value}</span>
        <span className="mt-1 block text-xs font-medium text-ink-mute">{label}</span>
      </span>
    </Link>
  );
}