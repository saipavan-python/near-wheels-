import Link from "next/link";
import { notFound } from "next/navigation";
import { Bus, CalendarDays, CheckCircle2, MapPin, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { packageInclude, publicPackage } from "@/lib/services/yatraService";

export default async function YatraDetails({ params }: { params: { id: string } }) {
  const found = await prisma.yatraBusPackage.findFirst({ where: { id: params.id, status: "PUBLISHED", isPublished: true, isActive: true }, include: packageInclude });
  if (!found || found.departureDate < new Date()) notFound();
  const pkg = publicPackage(found);
  return (
    <div className="min-h-screen bg-paper py-10 md:py-16">
      <div className="container-nw max-w-5xl">
        <Link href="/yatra-buses" className="link text-sm">Back to Yatra Buses</Link>
        <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_320px]">
          <article className="card p-6 md:p-8">
            <span className="eyebrow">Yatra Bus Journey</span>
            <h1 className="mt-3 font-display text-3xl font-extrabold text-ink md:text-4xl">{pkg.packageName}</h1>
            <p className="mt-4 leading-7 text-ink-mute">{pkg.description}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Info icon={<CalendarDays />} label="Departure" value={pkg.departureDate} />
              <Info icon={<Bus />} label="Bus" value={pkg.vehicle.title} />
              <Info icon={<Users />} label="Available" value={`${pkg.availableSeats} seats`} />
            </div>
            <h2 className="mt-10 font-display text-xl font-bold">Temple route</h2>
            <ol className="mt-5 space-y-0">
              {pkg.stops.map((stop: { id: string; order: number; name: string; city?: string | null }) => <li key={stop.id} className="relative flex gap-4 pb-6 last:pb-0"><span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-500 text-xs font-bold text-white">{String(stop.order).padStart(2, "0")}</span><span className="pt-1 font-semibold text-ink">{stop.name}{stop.city ? `, ${stop.city}` : ""}</span></li>)}
            </ol>
          </article>
          <aside className="card h-fit p-6">
            <div className="text-sm text-ink-mute">Price per person</div>
            <div className="mt-1 font-display text-3xl font-extrabold text-ink">₹{pkg.pricePerHead.toLocaleString("en-IN")}</div>
            <div className="mt-5 border-t border-ink/[0.08] pt-5 text-sm text-ink-soft"><CheckCircle2 className="mr-2 inline h-4 w-4 text-emerald-600" />{pkg.operator.verified ? "Verified operator" : "Operator"}</div>
            <div className="mt-3 text-sm text-ink-soft"><MapPin className="mr-2 inline h-4 w-4 text-brand-600" />{pkg.operator.name}</div>
            <Link href={`/yatra-buses/booking/${pkg.id}`} className="btn-primary mt-6 w-full">Book now</Link>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-xl bg-paper p-3"><div className="text-brand-600">{icon}</div><div className="mt-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint">{label}</div><div className="mt-1 text-sm font-semibold text-ink">{value}</div></div>;
}