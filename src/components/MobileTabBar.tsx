"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, CalendarDays, Sparkles, UserRound } from "lucide-react";

const tabs = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/vehicles", label: "Explore", Icon: Compass },
  { href: "/bookings", label: "Bookings", Icon: CalendarDays },
];

export default function MobileTabBar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/") || pathname.startsWith(href + "?");
  };
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/[0.08] bg-white/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary mobile"
    >
      <div className="grid grid-cols-5 gap-1 px-1">
        {tabs.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-xs font-semibold transition active:scale-[0.98] ${
                active ? "bg-brand-50 text-brand-700" : "text-ink-mute hover:bg-ink/[0.04] hover:text-ink"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} aria-hidden />
              {label}
            </Link>
          );
        })}

        <button
          onClick={() => window.dispatchEvent(new CustomEvent("nw:ai-ask", { detail: {} }))}
          className="relative -mt-3 flex min-h-[56px] flex-col items-center justify-center"
          aria-label="Ask Near Wheels AI"
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-500 text-white shadow-lift ring-4 ring-paper transition active:scale-95">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="mt-0.5 text-xs font-semibold text-brand-700">AI</span>
        </button>

        <Link
          href="/account"
          aria-current={isActive("/account") ? "page" : undefined}
          className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-xs font-semibold transition active:scale-[0.98] ${
            isActive("/account") ? "bg-brand-50 text-brand-700" : "text-ink-mute hover:bg-ink/[0.04] hover:text-ink"
          }`}
        >
          <UserRound className="h-5 w-5" strokeWidth={isActive("/account") ? 2.4 : 1.8} aria-hidden />
          Profile
        </Link>
      </div>
    </nav>
  );
}
