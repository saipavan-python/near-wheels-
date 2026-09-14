"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, inr, fmtWhen } from "@/lib/ui";
import { UserRound, CalendarDays, Heart, CreditCard, Star, XCircle, Building2, Wrench, Tractor, Plane } from "lucide-react";

interface Me {
  id: string;
  name?: string | null;
  phone: string;
  role: string;
}

export default function AccountPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [bookings, setBookings] = useState<any[] | null>(null);
  const [favorites, setFavorites] = useState<any[] | null>(null);

  useEffect(() => {
    const fetchMe = () =>
      api<{ user: Me | null }>("/api/auth/me").then((r) => {
        setMe(r.data.user);
        setLoaded(true);
        if (r.data.user) {
          api<{ bookings: any[] }>("/api/bookings").then((bb) => { if (bb.ok) setBookings(bb.data.bookings); });
          api<{ favorites: any[] }>("/api/favorites").then((ff) => { if (ff.ok) setFavorites(ff.data.favorites); });
        }
      });
    fetchMe();
    window.addEventListener("nw:auth", fetchMe);
    return () => window.removeEventListener("nw:auth", fetchMe);
  }, []);

  if (!loaded) return <div className="container-nw py-16"><div className="skeleton mx-auto h-40 max-w-lg" /></div>;

  if (!me) {
    return (
      <div className="container-nw flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-paper-deep text-ink-mute"><UserRound className="h-7 w-7" /></span>
        <h1 className="text-xl font-bold">You&apos;re not logged in</h1>
        <button className="btn-primary !px-8 !py-3" onClick={() => window.dispatchEvent(new CustomEvent("nw:open-login"))}>
          Login with mobile
        </button>
      </div>
    );
  }

  const upcoming = bookings ? bookings.filter((b) => ["REQUESTED","PENDING_PROVIDER","ACCEPTED","CONFIRMED","EN_ROUTE","IN_PROGRESS"].includes(b.status)).slice(0,3) : [];
  const completed = bookings ? bookings.filter((b) => b.status === "COMPLETED").slice(0,3) : [];
  const cancelled = bookings ? bookings.filter((b) => ["CANCELLED","REJECTED"].includes(b.status)).slice(0,3) : [];

  return (
    <div className="container-nw max-w-3xl py-8">
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-xl font-extrabold text-brand-800">
            {(me.name || me.phone).slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold">{me.name || "Near Wheels customer"}</h1>
            <p className="text-sm text-slate-500">+91 {me.phone} • {me.role}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-paper p-3"><p className="text-lg font-extrabold">{bookings?.length ?? "—"}</p><p className="text-ink-mute">Bookings</p></div>
          <div className="rounded-xl bg-paper p-3"><p className="text-lg font-extrabold">{favorites?.length ?? "—"}</p><p className="text-ink-mute">Saved</p></div>
          <div className="rounded-xl bg-paper p-3"><p className="text-lg font-extrabold">{completed.length}</p><p className="text-ink-mute">Completed</p></div>
        </div>

        {/* Provider — visible to every customer, professional */}
        <div className="mt-6 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-bold"><Building2 className="h-4 w-4 text-brand-600" /> Provide Your Vehicle</h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-mute">Professional Fleet Owner Program — one account, multiple vehicles, independent availability, secure bookings.</p>
            </div>
            <span className="hidden sm:inline-flex rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-white">Earn</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link href="/providers/dashboard" className="btn-primary flex items-center justify-center gap-2 !py-2.5 text-sm">
              Manage My Vehicles <span aria-hidden>→</span>
            </Link>
            <Link href="/providers/vehicles/add" className="btn-outline flex items-center justify-center gap-2 !py-2.5 text-sm">
              Host New Vehicle <span aria-hidden>→</span>
            </Link>
          </div>
          <p className="mt-2 text-center text-xs text-ink-faint">No provider yet? Click Host New Vehicle — we’ll create your provider profile automatically.</p>
        </div>

        <nav className="mt-6 space-y-2 border-t border-slate-100 pt-4 text-sm">
          <Link href="/bookings" className="flex items-center justify-between rounded-xl px-3 py-3 hover:bg-slate-50">
            My bookings <span aria-hidden>→</span>
          </Link>
          <div className="pt-2">
            <p className="px-3 pb-1 text-xs font-bold uppercase tracking-wide text-ink-faint">Professional Programs</p>
            <Link href="/providers/vehicles/register" className="flex items-center justify-between rounded-xl bg-brand-50 px-3 py-3 hover:bg-brand-100 border border-brand-100">
              <span><span className="font-semibold">Host Your Vehicle</span><span className="block text-xs text-ink-mute">Fleet Owner Program — Earn by renting</span></span> <span aria-hidden>→</span>
            </Link>
            <Link href="/providers/drivers/register" className="mt-2 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-3 hover:bg-emerald-100 border border-emerald-100">
              <span><span className="font-semibold">Elite Driver Network</span><span className="block text-xs text-ink-mute">Professional Driving Services — Drive & Earn</span></span> <span aria-hidden>→</span>
            </Link>
          </div>
        </nav>

        <button
          className="mt-6 w-full rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
          onClick={async () => {
            await api("/api/auth/me", { method: "DELETE" });
            window.dispatchEvent(new Event("nw:auth"));
          }}
        >
          Log out
        </button>
      </div>

      {/* Upcoming / Active bookings */}
      <section className="card mt-6 p-6">
        <h2 className="flex items-center gap-2 font-bold"><CalendarDays className="h-4 w-4 text-brand-600" /> Upcoming & Active</h2>
        {!bookings ? <div className="skeleton mt-4 h-20 w-full" /> : upcoming.length === 0 ? <p className="mt-3 rounded-xl bg-paper p-4 text-center text-sm text-ink-mute">No active bookings</p> : (
          <div className="mt-4 space-y-2">
            {upcoming.map((b:any) => (
              <div key={b.id} className="flex items-center justify-between rounded-xl border border-ink/10 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{b.listingTitle}</p>
                  <p className="text-xs text-ink-mute">{b.code} • {b.status} • {fmtWhen(b.scheduledFor)}</p>
                </div>
                <span className="text-sm font-bold">{inr(b.totalAmount)}</span>
              </div>
            ))}
            <Link href="/bookings" className="text-xs font-semibold text-brand-700">View all →</Link>
          </div>
        )}
      </section>

      <section className="card mt-6 p-6">
        <h2 className="flex items-center gap-2 font-bold"><Star className="h-4 w-4 text-amber-500" /> Completed <span className="text-xs font-normal text-ink-mute">({completed.length})</span></h2>
        {!bookings ? null : completed.length === 0 ? <p className="mt-3 text-sm text-ink-mute">No completed trips yet</p> : (
          <div className="mt-3 space-y-2">
            {completed.map((b:any) => (
              <div key={b.id} className="flex items-center justify-between rounded-xl bg-paper p-3">
                <div>
                  <p className="text-sm font-bold">{b.listingTitle}</p>
                  <p className="text-xs text-ink-mute">{fmtWhen(b.scheduledFor)} • {inr(b.totalAmount)}</p>
                </div>
                {b.review ? <span className="badge bg-amber-100 text-amber-800">{b.review.rating}/5</span> : <span className="text-xs text-ink-faint">Not rated</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card mt-6 p-6">
        <h2 className="flex items-center gap-2 font-bold"><XCircle className="h-4 w-4 text-red-500" /> Cancelled <span className="text-xs font-normal text-ink-mute">({cancelled.length})</span></h2>
        {cancelled.length > 0 && (
          <div className="mt-3 space-y-2">
            {cancelled.map((b:any) => (
              <div key={b.id} className="rounded-xl border border-red-100 bg-red-50 p-3">
                <p className="text-sm font-bold">{b.listingTitle} • {b.code}</p>
                <p className="text-xs text-red-700">{b.status} • {fmtWhen(b.scheduledFor)}</p>
              </div>
            ))}
          </div>
        )}
        {bookings && cancelled.length===0 && <p className="mt-3 text-sm text-ink-mute">No cancelled bookings</p>}
      </section>

      <section className="card mt-6 p-6">
        <h2 className="flex items-center gap-2 font-bold"><Heart className="h-4 w-4 text-red-500" /> Saved vehicles</h2>
        {!favorites ? <div className="skeleton mt-3 h-16 w-full" /> : favorites.length===0 ? <p className="mt-3 rounded-xl bg-paper p-4 text-center text-sm text-ink-mute">No saved vehicles yet — heart a vehicle to save it</p> : (
          <div className="mt-3 space-y-2">
            {favorites.slice(0,5).map((f:any) => (
              <div key={f.id} className="flex items-center justify-between rounded-xl border border-ink/10 p-3">
                <div>
                  <p className="text-sm font-bold">{f.provider?.businessName || f.label || "Saved vehicle"}</p>
                  <p className="text-xs text-ink-mute">{f.provider?.type}</p>
                </div>
                <Link href="/vehicles" className="text-xs font-semibold text-brand-700">View →</Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card mt-6 p-6">
        <h2 className="flex items-center gap-2 font-bold"><CreditCard className="h-4 w-4 text-emerald-600" /> Payment history</h2>
        {!bookings ? <div className="skeleton mt-3 h-16 w-full" /> : bookings.filter((b:any)=> b.payments?.length).length===0 ? <p className="mt-3 text-sm text-ink-mute">No payments yet</p> : (
          <div className="mt-3 space-y-2">
            {bookings.filter((b:any)=> b.payments?.length).slice(0,5).map((b:any) => (
              <div key={b.id} className="flex items-center justify-between rounded-xl border border-ink/10 p-3">
                <div>
                  <p className="text-sm font-bold">{b.code} • {b.paymentStatus}</p>
                  <p className="text-xs text-ink-mute">{fmtWhen(b.createdAt)} • {inr(b.totalAmount)}</p>
                </div>
                <span className={`badge ${b.paymentStatus==="PAID"?"bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-800"}`}>{b.paymentStatus}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Other Services — at the last, after Payment history */}
      <section className="card mt-6 p-6">
        <h2 className="flex items-center gap-2 font-bold"><Building2 className="h-4 w-4 text-ink-mute" /> Other Services</h2>
        <p className="mt-1 text-xs text-ink-mute">Explore more earning programs on Near Wheels.</p>
        <div className="mt-4 space-y-2">
          <Link href="/providers/garages/register" className="flex items-center justify-between rounded-xl border border-ink/10 bg-white px-4 py-3 hover:bg-slate-50">
            <span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-600"><Wrench className="h-4 w-4" /></span><span><span className="block text-sm font-semibold">Garage & Wash Point</span><span className="block text-xs text-ink-mute">Service Partner — Earn via repairs & wash</span></span></span> <span aria-hidden>→</span>
          </Link>
          <Link href="/providers/farm-equipment/register" className="flex items-center justify-between rounded-xl border border-ink/10 bg-white px-4 py-3 hover:bg-slate-50">
            <span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-green-50 text-green-600"><Tractor className="h-4 w-4" /></span><span><span className="block text-sm font-semibold">Agri Fleet</span><span className="block text-xs text-ink-mute">Farm Equipment Hosting — Tractors & harvesters</span></span></span> <span aria-hidden>→</span>
          </Link>
          <Link href="/providers/drone/register" className="flex items-center justify-between rounded-xl border border-ink/10 bg-white px-4 py-3 hover:bg-slate-50">
            <span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-600"><Plane className="h-4 w-4" /></span><span><span className="block text-sm font-semibold">Aerial Services</span><span className="block text-xs text-ink-mute">Drone Operations — Spraying & surveillance</span></span></span> <span aria-hidden>→</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
