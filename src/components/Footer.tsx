import Link from "next/link";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="bg-ink text-white/70">
      <div className="container-nw grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] md:py-16">
        <div>
          <Logo dark size={34} />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/50">
            Vehicles, drivers, garages, farm equipment and drone services — nearby,
            verified and bookable in minutes.
          </p>
          <p className="mt-6 font-display text-sm font-bold uppercase tracking-[0.22em] text-white/40">
            Your journey. Your wheels.
          </p>
        </div>

        <FooterCol
          title="Explore"
          links={[
            ["Vehicles", "/vehicles"],
            ["Drivers", "/drivers"],
            ["Garages", "/garages"],
            ["Farm & spraying drones", "/farm-services"],
            ["Emergency help", "/emergency"],
          ]}
        />
        <FooterCol
          title="Top cities"
          links={[
            ["Vehicle rentals in Kurnool", "/locations/kurnool"],
            ["Vehicle rentals in Nandyal", "/locations/nandyal"],
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            ["How it works", "/#how-it-works"],
            ["Why Near Wheels", "/#why"],
            ["Reviews", "/#reviews"],
            ["Ask Near Wheels AI", "/#ai"],
          ]}
        />
        <FooterCol
          title="For providers"
          links={[
            ["List your vehicle", "/providers/vehicles/register"],
            ["Register as driver", "/providers/drivers/register"],
            ["Register your garage", "/providers/garages/register"],
            ["Farm equipment", "/providers/farm-equipment/register"],
            ["Drone operators", "/providers/drone/register"],
            ["Register Yatra Bus", "/providers/yatra-bus/register"],
            ["Register Driving School", "/providers/driving-school/register"],
          ]}
        />
        <FooterCol
          title="Support"
          links={[
            ["My bookings", "/bookings"],
            ["My account", "/account"],
            ["Admin console", "/admin"],
          ]}
        />
      </div>

      <div className="border-t border-white/10 py-5">
        <div className="container-nw flex flex-col items-center justify-between gap-2 text-xs text-white/40 md:flex-row">
          <span>© {new Date().getFullYear()} Near Wheels. All rights reserved.</span>
          <span>Secure payments · Verified providers · 24×7 assistance</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">{title}</h4>
      <ul className="mt-4 space-y-2.5">
        {links.map(([label, href]) => (
          <li key={href + label}>
            <Link href={href} className="text-sm text-white/65 transition hover:text-brand-400">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
