"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import Logo from "./Logo";
import NotificationBell from "./NotificationBell";

interface MeData {
  user: { id: string; name?: string | null; phone: string; email?: string | null; role: string } | null;
  capabilities: string[];
  providerMemberships: Array<{ providerId: string; role: string; businessName: string; type: string }>;
  admin: any;
}

const nav = [
  { href: "/", label: "Home" },
  { href: "/share-my-ride", label: "Share My Ride " },
  { href: "/vehicles", label: "Vehicles" },
  { href: "/drivers", label: "Drivers" },
  { href: "/garages", label: "Garages" },
  { href: "/farm-services", label: "Farm & Drones" },
  { href: "/learn-driving", label: "Learn Driving " },
  { href: "/yatra-buses", label: "Yatra Buses " },
];

export default function Header() {
  const [meData, setMeData] = useState<MeData>({ user: null, capabilities: [], providerMemberships: [], admin: null });
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const load = () =>
      fetch("/api/auth/me")
        .then((r) => r.json())
        .then((d) => setMeData({
          user: d.user || null,
          capabilities: Array.isArray(d.capabilities) ? d.capabilities : d.user?.role === "PROVIDER" ? ["CUSTOMER", "PROVIDER"] : ["CUSTOMER"],
          providerMemberships: Array.isArray(d.providerMemberships) ? d.providerMemberships : [],
          admin: d.admin || null,
        }))
        .catch(() => undefined);
    load();
    window.addEventListener("nw:auth", load);
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("nw:auth", load);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const me = meData.user;
  const isProvider = meData.capabilities.includes("PROVIDER");
  const isAdmin = meData.capabilities.includes("ADMIN");

  const askAi = () => window.dispatchEvent(new CustomEvent("nw:ai-ask", { detail: {} }));

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${scrolled
        ? "border-b border-ink/[0.07] bg-white/85 shadow-sm backdrop-blur-md"
        : "border-b border-transparent bg-paper"
        }`}
    >
      <div className={`container-nw flex items-center justify-between gap-3 transition-all duration-300 ${scrolled ? "h-14" : "h-[72px]"}`}>
        <Link href="/" className="flex items-center gap-2.5" aria-label="Near Wheels home">
          <Logo size={34} />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-mute transition hover:bg-ink/[0.04] hover:text-ink"
            >
              {n.label}
            </Link>
          ))}
          <Link href="/emergency" className="group flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-50">
            Emergency
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
              <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
            </span>
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={askAi}
            className="hidden items-center gap-1.5 rounded-xl border border-ink/15 px-3 py-2 text-sm font-semibold text-ink transition hover:border-brand-500 hover:text-brand-700 md:inline-flex"
          >
            <Sparkles className="h-4 w-4 text-brand-500" />
            Ask Near Wheels
          </button>

          {me ? (
            <>
              <NotificationBell signedIn={!!me} />
              <div className="relative">
              <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-full border border-ink/10 bg-white px-3 py-1.5 shadow-sm hover:shadow-md">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-xs font-bold text-white">
                  {(me.name || me.phone || "U").slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden text-sm font-semibold sm:inline">{(me.name || me.phone || "").split(" ")[0] || "Account"}</span>
                <span className="text-ink-faint">▾</span>
              </button>
              {open && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                  <div className="sheet-in absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl border border-ink/[0.07] bg-white py-1.5 shadow-lift">
                    <div className="px-4 py-2.5 bg-paper/50 border-b border-ink/5">
                      <p className="text-sm font-bold truncate">{me.name || "Account"}</p>
                      <p className="text-xs text-ink-mute truncate">{me.phone || me.email || ""}</p>
                    </div>

                    {/* Mode switch */}
                    {isProvider ? (
                      <div className="px-3 py-2 border-b border-ink/5 bg-brand-50/40">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faint mb-1.5">Workspace Mode</p>
                        <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink/5 p-1">
                          <Link
                            href="/"
                            onClick={() => setOpen(false)}
                            className="rounded-lg py-1.5 text-center text-xs font-bold transition text-ink-mute hover:bg-white hover:text-ink shadow-none"
                          >
                            Customer
                          </Link>
                          <Link
                            href="/provider/dashboard"
                            onClick={() => setOpen(false)}
                            className="rounded-lg bg-brand-600 py-1.5 text-center text-xs font-bold text-white shadow-sm transition hover:bg-brand-700"
                          >
                            Provider
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="border-b border-ink/5 p-2 bg-brand-50/30">
                        <Link
                          href="/provider/onboarding"
                          onClick={() => setOpen(false)}
                          className="flex items-center justify-between rounded-xl bg-white border border-brand-200 px-3 py-2 text-xs font-bold text-brand-800 transition hover:bg-brand-50"
                        >
                          <span>Become a Provider</span>
                          <span className="text-[10px] font-extrabold uppercase bg-brand-600 text-white px-1.5 py-0.5 rounded">Free</span>
                        </Link>
                      </div>
                    )}

                    {isAdmin && (
                      <MenuLink href="/admin" onClick={() => setOpen(false)}>
                        <span className="font-semibold text-purple-700">Admin Dashboard</span>
                      </MenuLink>
                    )}

                    <MenuLink href="/bookings" onClick={() => setOpen(false)}>My bookings</MenuLink>
                    <MenuLink href="/account" onClick={() => setOpen(false)}>Account settings</MenuLink>

                    <button
                      className="mt-1 block w-full border-t border-ink/[0.06] px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                      onClick={async () => {
                        await fetch("/api/auth/me", { method: "DELETE" });
                        window.dispatchEvent(new Event("nw:auth"));
                        location.href = "/";
                      }}
                    >
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
            </>
          ) : (
            <button
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-ink/90"
              onClick={() => window.dispatchEvent(new CustomEvent("nw:open-login"))}
              aria-label="Log in — one account for customers, providers and admins"
            >
              <span className="grid h-5 w-5 place-items-center rounded-full bg-white/15 text-xs">◉</span>
              Log in
            </button>
          )}
          <Link href="/vehicles" className="btn-primary hidden !py-2 md:inline-flex">
            Get Started
          </Link>
        </div>
      </div>

      {/* mobile quick links */}
      <nav className="flex gap-2 overflow-x-auto border-t border-ink/[0.06] px-3 py-2.5 lg:hidden hide-scrollbar" aria-label="Quick navigation">
        {nav.concat([{ href: "/emergency", label: "Emergency" }]).map((n) => (
          <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-full bg-ink/[0.05] px-4 py-2.5 text-sm font-semibold text-ink-mute transition hover:bg-ink hover:text-white active:scale-[0.98]">
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function MenuLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="block px-4 py-2 text-sm text-ink-soft hover:bg-paper">
      {children}
    </Link>
  );
}
