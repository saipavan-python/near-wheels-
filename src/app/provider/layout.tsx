"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, CarFront, Calendar, UserRound, Wrench, FileText, MessageSquare, Bell, DollarSign, Star, TrendingUp, Users, Settings, LogOut, Sparkles, ChevronRight, Menu, X, ArrowLeft, ShieldAlert
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";

const SIDEBAR_ITEMS = [
  { href: "/provider/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/provider/assets", label: "Assets & Vehicles", icon: CarFront },
  { href: "/provider/availability", label: "Availability Calendar", icon: Calendar },
  { href: "/provider/drivers", label: "Drivers", icon: UserRound },
  { href: "/provider/services", label: "Services & Garage", icon: Wrench },
  { href: "/provider/bookings", label: "Bookings", icon: FileText },
  { href: "/provider/messages", label: "Messages", icon: MessageSquare },
  { href: "/provider/notifications", label: "Notifications", icon: Bell },
  { href: "/provider/earnings", label: "Earnings & Financials", icon: DollarSign },
  { href: "/provider/reviews", label: "Reviews", icon: Star },
  { href: "/provider/analytics", label: "Analytics", icon: TrendingUp },
  { href: "/provider/team", label: "Team & Staff", icon: Users },
  { href: "/provider/settings", label: "Settings", icon: Settings },
];

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authData, setAuthData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setLoading(false);
        if (!d.user) {
          router.push(`/login?returnTo=${encodeURIComponent(pathname)}`);
          return;
        }
        const caps: string[] = d.capabilities || [];
        if (!caps.includes("PROVIDER")) {
          // Customer trying to access provider workspace -> redirect to onboarding
          if (!pathname.includes("/provider/onboarding")) {
            router.push("/provider/onboarding");
            return;
          }
        }
        setAuthData(d);
      })
      .catch(() => setLoading(false));
  }, [pathname, router]);

  // If onboarding route, render standalone without sidebar shell
  if (pathname.includes("/provider/onboarding")) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-brand-600 border-t-transparent" />
          <p className="text-sm font-bold text-ink-mute">Loading Provider Workspace…</p>
        </div>
      </div>
    );
  }

  const user = authData?.user;
  const providerOrg = authData?.providerMemberships?.[0];

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {/* Mobile Sidebar Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <Link href="/" className="flex items-center gap-2 font-display text-sm font-extrabold text-brand-700">
          <CarFront className="h-5 w-5 text-brand-600" /> Near Wheels Provider
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell signedIn={!!authData?.user} />
          <button onClick={() => setMobileOpen(!mobileOpen)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-slate-200 bg-white p-4 transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col justify-between">
          <div>
            {/* Header / Mode switch link */}
            <div className="mb-6 border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 font-display text-base font-extrabold text-ink">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-600 text-white font-bold text-sm">NW</span>
                  <span>Provider Hub</span>
                </Link>
                <NotificationBell signedIn={!!authData?.user} />
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-100 p-1.5 text-xs font-bold">
                <Link href="/" className="flex-1 text-center py-1 text-slate-600 hover:text-ink">Customer</Link>
                <span className="flex-1 text-center py-1 rounded-lg bg-white text-brand-700 shadow-sm">Provider</span>
              </div>
            </div>

            {/* Business Org Title */}
            {providerOrg && (
              <div className="mb-4 rounded-xl border border-brand-100 bg-brand-50/50 p-2.5">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-700">Active Business</p>
                <p className="text-xs font-bold text-ink truncate">{providerOrg.businessName}</p>
                <span className="text-[10px] text-brand-800 font-semibold">{providerOrg.role}</span>
              </div>
            )}

            {/* Sidebar menu items */}
            <nav className="space-y-1 overflow-y-auto max-h-[calc(100vh-280px)] hide-scrollbar">
              {SIDEBAR_ITEMS.map((item) => {
                const active = pathname === item.href || (item.href !== "/provider/dashboard" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                      active
                        ? "bg-brand-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-ink"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User profile & logout */}
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2 px-1 py-1.5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-900 text-xs font-extrabold text-white">
                {(user?.name || user?.phone || "P").slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-ink truncate">{user?.name || "Provider Owner"}</p>
                <p className="text-[10px] text-slate-500 truncate">{user?.phone || ""}</p>
              </div>
            </div>
            <Link href="/" className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Main Marketplace
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
