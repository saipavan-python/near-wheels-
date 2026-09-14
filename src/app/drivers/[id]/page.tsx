import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Star, BadgeCheck, MapPin, Languages, CarFront, Award, CalendarClock, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { findRuleForTarget, quoteFromRule } from "@/lib/services/pricingService";
import { isDriverBlockedByAvailability, isAvailableNow } from "@/lib/services/availabilityService";
import { portraitImage, IMGS } from "@/lib/imagery";
import BookingLauncher from "@/components/detail/BookingLauncher";
import type { ResultCard } from "@/lib/types";

export const revalidate = 60;

async function findDriver(id: string) {
  const prof = await prisma.driverProfile.findUnique({ where: { id }, include: { provider: true } });
  if (prof) return { prof, roster: null };
  const roster = await prisma.driver.findUnique({ where: { id }, include: { provider: true } });
  return { prof: null, roster };
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const { prof, roster } = await findDriver(params.id);
  if (!prof && !roster) return { title: "Driver not found" };
  const name = prof?.provider.businessName || roster?.name;
  return {
    title: `${name} — Professional driver`,
    description: `Book ${name} on Near Wheels.`,
    openGraph: { images: [IMGS.driverProfile] },
  };
}

export default async function DriverDetail({ params }: { params: { id: string } }) {
  const { prof, roster } = await findDriver(params.id);
  if ((!prof && !roster) || !(prof?.provider || roster?.provider)) notFound();
  const p: any = prof?.provider || roster!.provider;
  if (p.status !== "ACTIVE") notFound();
  const id = prof?.id || roster!.id;

  let languages: string[] = [];
  let categories: string[] = [];
  if (prof) {
    try { languages = JSON.parse(prof.languages); } catch {}
    try { categories = JSON.parse(prof.driveCategories); } catch {}
  } else {
    try { languages = JSON.parse(roster!.languagesJson); } catch {}
    try { categories = JSON.parse(roster!.categoriesJson); } catch {}
  }

  const rule = await findRuleForTarget(p.id, "DRIVER", id);
  const dayQuote = quoteFromRule(rule, { days: 1 });
  const from = dayQuote?.total ?? null;

  // Roster driver availability today (no date-block covering today)
  let availableNow = isAvailableNow(p);
  if (roster) {
    const { blocked } = await isDriverBlockedByAvailability(roster.id, null);
    availableNow = isAvailableNow(p) && !blocked;
  }

  const drivesLabel = categories.length ? categories.join(", ").toLowerCase() : "car & auto";

  const card: ResultCard = {
    kind: "DRIVER",
    id,
    providerId: p.id,
    title: prof ? p.businessName : roster!.name,
    subtitle: `${prof?.experienceYears ?? roster!.experienceYears} yrs experience${languages.length ? ` · ${languages.slice(0, 2).join(", ")}` : ""}`,
    category: "DRIVER",
    distanceKm: null,
    etaMin: null,
    availableNow,
    priceLabel: from != null ? `₹${Math.round(from).toLocaleString("en-IN")}/day` : "Ask for price",
    priceFrom: from,
    rating: p.ratingAvg,
    verified: p.isVerified,
    badges: [],
    emoji: "",
    meta: { name: prof ? p.businessName : roster!.name, drives: categories.join(", ") },
  };

  const displayName = prof ? p.businessName : roster!.name;

  return (
    <div className="container-nw pt-6 md:pt-10">
      <Link href="/drivers" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-mute transition hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> All drivers
      </Link>

      <div className="mt-6 grid gap-10 pb-16 lg:grid-cols-[1fr_400px] lg:gap-14">
        <div>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <img
              src={roster?.photoUrl || IMGS.driverProfile}
              alt={displayName}
              className="h-48 w-48 rounded-[2rem] object-cover object-top shadow-card md:h-56 md:w-56"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">{displayName}</h1>
                {p.isVerified || roster?.verificationStatus === "VERIFIED" ? (
                  <span className="badge bg-emerald-100 text-emerald-800"><BadgeCheck className="h-3.5 w-3.5" /> Verified driver</span>
                ) : roster?.licenseStatus === "VERIFIED" ? (
                  <span className="badge bg-emerald-100 text-emerald-800"><ShieldCheck className="h-3.5 w-3.5" /> License verified</span>
                ) : null}
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-mute">
                <span className="flex items-center gap-1 font-semibold text-ink">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {p.ratingAvg > 0 ? `${p.ratingAvg.toFixed(1)} (${p.ratingCount})` : "New"}
                </span>
                <span className="flex items-center gap-1"><Award className="h-4 w-4" /> {prof?.experienceYears ?? roster!.experienceYears} years experience</span>
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {p.addressText || `${p.lat.toFixed(2)}, ${p.lng.toFixed(2)}`}</span>
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Fact Icon={Languages} title="Languages" value={languages.length ? languages.join(", ") : "Telugu, English"} />
            <Fact Icon={CarFront} title="Drives" value={drivesLabel} />
            <Fact Icon={CalendarClock} title="Completed trips" value={String(p.completedJobs)} />
          </div>

          <section className="mt-9">
            <h2 className="font-display text-xl font-bold tracking-tight">About</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-mute">
              {p.about || `${displayName} is a professional driver serving ${p.addressText || "the local area"} with a ${(prof?.licenseType || roster?.licenseType || "LMV")} licence. Drives ${drivesLabel}. Punctual, courteous and familiar with local routes — rated ${p.ratingAvg > 0 ? `${p.ratingAvg.toFixed(1)}` : "fresh on the platform"} across ${p.completedJobs} completed trips.`}
            </p>
          </section>

          <section className="mt-9">
            <h2 className="font-display text-xl font-bold tracking-tight">Reviews</h2>
            {p.ratingCount > 0 ? (
              <p className="mt-2 text-sm text-ink-mute">{p.ratingAvg.toFixed(1)} out of 5 · based on {p.ratingCount} verified booking reviews.</p>
            ) : (
              <p className="mt-2 text-sm text-ink-mute">No reviews yet — be the first after your trip.</p>
            )}
          </section>
        </div>

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
              <span className={`badge px-3 py-1.5 ${availableNow ? "bg-emerald-100 text-emerald-800" : "bg-paper-deep text-ink-mute"}`}>
                {availableNow ? "Available today" : "On schedule"}
              </span>
            </div>
            <div className="mt-6">
              <BookingLauncher card={card} ctaLabel="Book Driver" />
            </div>
            <ul className="mt-5 space-y-2 border-t border-ink/[0.06] pt-4 text-xs text-ink-mute">
              <li>Hourly and outstation pricing available at booking.</li>
              <li>Payments held by Near Wheels until trip completion.</li>
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
      <p className="truncate text-sm font-bold capitalize">{value}</p>
    </div>
  );
}