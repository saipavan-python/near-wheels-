"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, inr } from "@/lib/ui";
import { vehicleImage } from "@/lib/imagery";
import {
  CarFront, Building2, Clock, CheckCircle, XCircle, AlertTriangle, Power, Wrench, Calendar, MapPin, Plus, Eye, Pencil, Ban, Settings, TrendingUp, Users, DollarSign, Activity, Timer, Star, ShieldCheck, ChevronRight, Trash2
} from "lucide-react";

type Provider = {
  id: string;
  businessName: string;
  type: string;
  status: string;
  availabilityStatus: string;
  lat: number;
  lng: number;
  addressText: string | null;
  isVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  completedJobs: number;
  phone: string;
  vehicles?: any[];
  bookings?: any[];
};

type VehicleEnriched = {
  id: string;
  title: string;
  make: string;
  model: string;
  category: string;
  seats: number;
  status: string;
  imageUrl: string | null;
  images: string[];
  isUnavailableToday: boolean;
  todayBlock: any | null;
  upcomingBlocks: any[];
  activeBookings: number;
  todayBookings: number;
  pricing: any | null;
  availableAgain: string | null;
  year?: number;
  color?: string;
  registrationNumber?: string;
  ac?: boolean;
  fuelType?: string;
  transmission?: string;
};

export default function ProviderDashboardClient({ provider: initial, allProviders, stats }: { provider: Provider; allProviders: Provider[]; stats: any }) {
  const [provider, setProvider] = useState(initial);
  const [vehicles, setVehicles] = useState<VehicleEnriched[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeVehicle, setActiveVehicle] = useState<VehicleEnriched | null>(null);
  const [showAvailModal, setShowAvailModal] = useState<VehicleEnriched | null>(null);
  const [calendarData, setCalendarData] = useState<{ availabilities: any[]; bookings: any[] } | null>(null);

  const loadVehicles = async () => {
    setLoading(true);
    const r = await api<{ vehicles: VehicleEnriched[] }>("/api/providers/vehicles");
    setLoading(false);
    if (r.ok) setVehicles(r.data.vehicles);
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  async function setProviderAvailability(status: string) {
    setBusy(true);
    setMsg(null);
    const r = await api("/api/providers/actions", { json: { action: "set_availability", availabilityStatus: status } });
    setBusy(false);
    if (!r.ok) return setMsg(r.data.error || "Failed to update availability");
    setProvider({ ...provider, availabilityStatus: status });
    setMsg(`Availability set to ${status.replace("_", " ")}`);
  }

  async function toggleUnavailableToday(v: VehicleEnriched) {
    const isUnavailable = v.isUnavailableToday;
    if (isUnavailable) {
      if (!confirm(`Make ${v.title} available again for today?`)) return;
      const r = await api(`/api/providers/vehicles/${v.id}/unavailable-today`, { method: "DELETE" });
      if (!r.ok) return alert(r.data.error || "Failed");
      setMsg(`${v.title} is now available for today`);
      loadVehicles();
    } else {
      if (!confirm(`Mark ${v.title} as not available for today? It will be hidden from search results for today.`)) return;
      const r = await api(`/api/providers/vehicles/${v.id}/unavailable-today`, { json: { reason: "PERSONAL_USE" } });
      if (!r.ok) return alert(r.data.error || "Failed to mark unavailable");
      setMsg(`${v.title} marked as not available for today`);
      loadVehicles();
    }
  }

  async function handleBooking(id: string, action: string) {
    const r = await api(`/api/bookings/${id}`, { method: "PATCH", json: { action } });
    if (!r.ok) return setMsg(r.data.error || "Action failed");
    location.reload();
  }

  async function openAvailability(v: VehicleEnriched) {
    setShowAvailModal(v);
    const r = await api(`/api/providers/vehicles/${v.id}/availability`);
    if (r.ok) setCalendarData(r.data);
  }

  const availabilityOptions = [
    { value: "AVAILABLE_NOW", label: "Available now", desc: "Show in search — customers can book", icon: Power },
    { value: "BUSY", label: "Busy — Personal use", desc: "Hide from search — personal use", icon: Clock },
    { value: "OFFLINE", label: "Offline", desc: "Hide — not taking bookings", icon: XCircle },
    { value: "MAINTENANCE", label: "Maintenance", desc: "Under service", icon: Wrench },
  ] as const;

  // Compute overview stats from vehicles
  const totalVehicles = vehicles?.length ?? stats.totalVehicles ?? 0;
  const availableVehicles = vehicles ? vehicles.filter((v) => v.status === "ACTIVE" && !v.isUnavailableToday).length : 0;
  const unavailableToday = vehicles ? vehicles.filter((v) => v.isUnavailableToday).length : 0;
  const maintenance = vehicles ? vehicles.filter((v) => v.status === "MAINTENANCE").length : 0;
  const inactive = vehicles ? vehicles.filter((v) => v.status === "INACTIVE").length : 0;

  const todayBookingsCount = provider.bookings?.filter((b: any) => {
    if (!b.scheduledFor) return false;
    const d = new Date(b.scheduledFor);
    const today = new Date();
    return d.toDateString() === today.toDateString() && ["REQUESTED","PENDING_PROVIDER","ACCEPTED","CONFIRMED","EN_ROUTE","IN_PROGRESS"].includes(b.status);
  }).length || 0;
  const upcomingBookings = provider.bookings?.filter((b: any) => b.scheduledFor && new Date(b.scheduledFor) > new Date() && ["REQUESTED","PENDING_PROVIDER","ACCEPTED","CONFIRMED"].includes(b.status)).length || 0;
  const activeBookings = provider.bookings?.filter((b: any) => ["REQUESTED","PENDING_PROVIDER","ACCEPTED","CONFIRMED","EN_ROUTE","IN_PROGRESS"].includes(b.status)).length || 0;

  const hasVehicles = totalVehicles > 0;

  return (
    <div className="container-nw py-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Provider dashboard</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{provider.businessName}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-mute">
            <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-white">{provider.type}</span>
            {provider.isVerified && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800"><CheckCircle className="h-3 w-3" /> Verified</span>}
            <span className="inline-flex items-center gap-1 text-xs"><Star className="h-3.5 w-3.5 text-amber-500" /> {provider.ratingAvg.toFixed(1)} ({provider.ratingCount}) • {provider.completedJobs} trips</span>
            <span className="inline-flex items-center gap-1 text-xs"><MapPin className="h-3 w-3" />{provider.addressText || `${provider.lat.toFixed(2)}, ${provider.lng.toFixed(2)}`}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`badge px-3 py-1.5 ${provider.availabilityStatus === "AVAILABLE_NOW" ? "bg-emerald-100 text-emerald-800" : provider.availabilityStatus === "BUSY" ? "bg-amber-100 text-amber-800" : "bg-paper-deep text-ink-mute"}`}>
            {provider.availabilityStatus.replace("_", " ")}
          </span>
          <Link href="/providers/vehicles/add" className="btn-primary !py-2 text-sm">
            <Plus className="h-4 w-4" /> Add Vehicle
          </Link>
        </div>
      </div>

      {msg && <p className="card mt-4 border-brand-100 bg-brand-50 p-3 text-sm font-medium text-brand-800">{msg}</p>}

      {/* Onboarding */}
      {!hasVehicles && !loading && (
        <div className="card mt-6 border-brand-200 bg-gradient-to-br from-brand-50 to-white p-6">
          <h2 className="font-display text-xl font-bold">Welcome to Near Wheels</h2>
          <p className="mt-1 text-sm text-ink-mute">Follow these steps to start receiving bookings.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <Step num={1} title="Complete Profile" done={true} desc="✓ Verified provider" />
            <Step num={2} title="Register Your First Vehicle" done={false} active={true} href="/providers/vehicles/add" desc="Add Maruti Swift, Ertiga, etc." />
            <Step num={3} title="Set Availability" done={false} desc="Control when you're bookable" />
            <Step num={4} title="Start Receiving Bookings" done={false} desc="Get requests near you" />
          </div>
          <Link href="/providers/vehicles/add" className="btn-primary mt-6 inline-flex">
            Register Your Vehicle <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {hasVehicles && (
        <div className="card mt-6 bg-sky-50 p-4 text-sm">
          <p className="font-semibold text-sky-900">Your vehicle is now listed on Near Wheels.</p>
          <p className="text-xs text-sky-700">Manage availability below. Use “Not Available Today” to hide a vehicle for today without deleting it.</p>
        </div>
      )}

      {/* Overview stats */}
      <section className="mt-6">
        <h2 className="flex items-center gap-2 font-bold"><Activity className="h-4 w-4 text-brand-600" /> Overview</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard icon={CarFront} label="Total vehicles" value={totalVehicles} sub={`${availableVehicles} available`} />
          <StatCard icon={CheckCircle} label="Available" value={availableVehicles} tone="emerald" />
          <StatCard icon={Ban} label="Unavailable today" value={unavailableToday} tone="amber" />
          <StatCard icon={Wrench} label="Maintenance" value={maintenance} tone="red" sub={inactive ? `${inactive} inactive` : undefined} />
          <StatCard icon={Timer} label="Today's bookings" value={todayBookingsCount} tone="blue" />
          <StatCard icon={Calendar} label="Upcoming" value={upcomingBookings} tone="blue" />
          <StatCard icon={Users} label="Active bookings" value={activeBookings} tone="blue" />
          <StatCard icon={DollarSign} label="Revenue" value={inr(provider.bookings?.reduce((s:any,b:any)=> b.status==="COMPLETED"? s+ (b.totalAmount||0):s,0) || 0)} sub="Completed trips" />
        </div>
      </section>

      {/* Share Your Ride — Earnings (like here your ride earnings) */}
      <section className="card mt-6 border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-bold"><Users className="h-4 w-4 text-brand-600" /> Share Your Ride — Earnings</h2>
            <p className="mt-1 text-xs text-ink-mute">Offer empty seats on your trips and earn per seat — like carpool earnings. Visible to all nearby travelers.</p>
          </div>
          <Link href="/share-my-ride/offer" className="btn-primary !py-2 text-sm"><Plus className="h-4 w-4" /> Offer a Ride</Link>
        </div>
        <ShareRideEarnings provider={provider} />
        <div className="mt-3 flex gap-2">
          <Link href="/share-my-ride/my-rides" className="btn-outline !py-2 text-xs">My Shared Rides</Link>
          <Link href="/share-my-ride" className="btn-outline !py-2 text-xs">Browse Rides</Link>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-6">
          {/* Provider availability */}
          <section className="card p-5">
            <h2 className="flex items-center gap-2 font-bold"><Power className="h-4 w-4 text-brand-600" /> Provider Availability</h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-mute">
              This controls your whole profile. For per-vehicle control use “Not Available Today” on each vehicle card.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {availabilityOptions.map(({ value, label, desc, icon: Icon }) => (
                <button
                  key={value}
                  disabled={busy}
                  onClick={() => setProviderAvailability(value)}
                  className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition ${provider.availabilityStatus === value ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-ink/10 bg-white hover:border-brand-300 hover:bg-paper"}`}
                >
                  <span className={`grid h-9 w-9 place-items-center rounded-xl ${provider.availabilityStatus === value ? "bg-brand-500 text-white" : "bg-paper text-ink-mute"}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold leading-tight">{label}</span>
                    <span className="block text-xs leading-snug text-ink-mute">{desc}</span>
                  </span>
                  {provider.availabilityStatus === value && <CheckCircle className="mt-1 h-4 w-4 shrink-0 text-brand-600" />}
                </button>
              ))}
            </div>
          </section>

          {/* My Vehicles */}
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-bold"><CarFront className="h-4 w-4" /> My Vehicles ({totalVehicles})</h2>
              <Link href="/providers/vehicles/add" className="btn-outline !py-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> Add New Vehicle</Link>
            </div>

            {loading ? (
              <div className="mt-4 space-y-3">
                <div className="skeleton h-24 w-full" />
                <div className="skeleton h-24 w-full" />
              </div>
            ) : vehicles && vehicles.length === 0 ? (
              <div className="mt-4 rounded-2xl border-2 border-dashed border-ink/10 bg-paper p-8 text-center">
                <CarFront className="mx-auto h-8 w-8 text-ink-faint" />
                <p className="mt-2 text-sm font-semibold">No vehicles yet</p>
                <p className="text-xs text-ink-mute">Register your first vehicle — customers nearby will find it.</p>
                <Link href="/providers/vehicles/add" className="btn-primary mt-4 inline-flex">Register Your Vehicle</Link>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {vehicles?.map((v, idx) => (
                  <div key={v.id} className="group flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm transition hover:shadow-md">
                    <div className="relative">
                      <img src={v.imageUrl || vehicleImage(v.title, v.category)} alt={v.title} className="h-36 w-full object-cover" />
                      <span className={`absolute left-3 top-3 badge px-2.5 py-1 text-xs ${v.isUnavailableToday ? "bg-amber-500 text-white" : v.status === "ACTIVE" ? "bg-emerald-500 text-white" : v.status === "MAINTENANCE" ? "bg-red-500 text-white" : "bg-black/60 text-white"}`}>
                        {v.isUnavailableToday ? "Not Available Today" : v.status === "ACTIVE" ? "● Available" : v.status}
                      </span>
                      <span className="absolute right-3 top-3 rounded-full bg-ink px-2 py-1 text-xs font-bold text-white shadow">#{idx + 1} of {vehicles.length}</span>
                      {v.isUnavailableToday && v.availableAgain && <span className="absolute right-3 top-12 rounded-full bg-white px-2 py-1 text-xs font-semibold shadow">Again {new Date(v.availableAgain).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold leading-tight">{v.title}</h3>
                        <span className="shrink-0 rounded-full bg-paper px-2 py-0.5 text-xs font-bold">Vehicle #{idx + 1}</span>
                      </div>
                      <p className="text-xs text-ink-mute">{v.category} • {v.seats} seats {v.fuelType ? `• ${v.fuelType}` : ""} {v.transmission ? `• ${v.transmission}` : ""} {v.ac ? "• AC" : ""}</p>
                      {v.registrationNumber && <p className="mt-1 inline-flex items-center gap-1 rounded bg-ink/5 px-2 py-0.5 text-xs font-mono font-semibold">No: {v.registrationNumber}</p>}
                      {!v.registrationNumber && <p className="mt-1 text-xs text-ink-faint">No: — • Add via Edit</p>}
                      <p className="mt-1 text-sm font-extrabold text-brand-700">{v.pricing?.dailyRate ? inr(v.pricing.dailyRate)+"/day" : v.pricing?.hourlyRate ? inr(v.pricing.hourlyRate)+"/hr" : v.pricing?.perKm ? inr(v.pricing.perKm)+"/km" : "Price on request"}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-ink-mute"><MapPin className="h-3 w-3" /> Guntur • {v.activeBookings} bookings</p>
                      {v.isUnavailableToday && v.todayBlock && <p className="mt-1 text-xs text-amber-700">Reason: {v.todayBlock.reason} {v.todayBlock.note ? `• ${v.todayBlock.note}` : ""}</p>}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Link href={`/vehicles/${v.id}`} className="btn-outline !py-2 text-xs"><Eye className="h-3.5 w-3.5" /> View</Link>
                        <Link href={`/providers/vehicles/${v.id}/edit`} className="btn-outline !py-2 text-xs"><Pencil className="h-3.5 w-3.5" /> Edit</Link>
                        <button onClick={() => openAvailability(v)} className="btn-outline !py-2 text-xs"><Ban className="h-3.5 w-3.5" /> Not Available</button>
                        <button
                          onClick={() => toggleUnavailableToday(v)}
                          className={`!py-2 text-xs font-bold ${v.isUnavailableToday ? "btn-primary bg-amber-500 hover:bg-amber-600 border-amber-500" : "btn-dark"}`}
                        >
                          {v.isUnavailableToday ? "Make Available" : "Not Available Today"}
                        </button>
                      </div>
                      {!v.isUnavailableToday && <button onClick={() => openAvailability(v)} className="mt-2 text-xs font-semibold text-brand-700 hover:underline">Manage Availability →</button>}
                      {v.isUnavailableToday && <button onClick={() => openAvailability(v)} className="mt-2 text-xs font-semibold text-amber-700 hover:underline">Manage Availability →</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Provider profile */}
          <section className="card p-5">
            <h2 className="flex items-center gap-2 font-bold"><Building2 className="h-4 w-4" /> Provider Profile</h2>
            <div className="mt-4 flex items-start gap-4">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-ink text-xl font-bold text-white">{provider.businessName.slice(0,1).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-bold">{provider.businessName}</p>
                <p className="flex flex-wrap gap-2 text-xs text-ink-mute"><span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> {provider.isVerified ? "Verified" : "Pending verification"}</span> • {provider.status} • {totalVehicles} vehicles • {provider.completedJobs} trips</p>
                <p className="mt-1 text-xs text-ink-mute">{provider.addressText}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-paper p-3"><p className="text-lg font-extrabold">{totalVehicles}</p><p className="text-xs text-ink-mute">Total vehicles</p></div>
              <div className="rounded-xl bg-paper p-3"><p className="text-lg font-extrabold text-emerald-700">{availableVehicles}</p><p className="text-xs text-ink-mute">Active</p></div>
              <div className="rounded-xl bg-paper p-3"><p className="text-lg font-extrabold text-amber-700">{unavailableToday}</p><p className="text-xs text-ink-mute">Unavailable today</p></div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="flex items-center gap-2 font-bold"><Calendar className="h-4 w-4" /> Recent bookings {activeBookings ? <span className="badge bg-amber-100 text-amber-800">{activeBookings} active</span> : null}</h2>
            <div className="mt-4 space-y-2">
              {(provider.bookings || []).length === 0 ? (
                <p className="rounded-xl bg-paper p-6 text-center text-sm text-ink-mute">No bookings yet — when a customer books your vehicle, it appears here.</p>
              ) : (
                provider.bookings!.slice(0, 5).map((b: any) => (
                  <div key={b.id} className="rounded-xl border border-ink/10 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{b.listingTitle}</p>
                        <p className="truncate text-xs text-ink-mute">{b.code} • {b.status} • {b.kind} {b.scheduledFor ? `• ${new Date(b.scheduledFor).toLocaleDateString("en-IN")}` : ""}</p>
                      </div>
                      <span className="shrink-0 text-sm font-extrabold">{inr(b.totalAmount)}</span>
                    </div>
                    {["REQUESTED", "PENDING_PROVIDER"].includes(b.status) && (
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => handleBooking(b.id, "accept")} className="btn-primary min-h-[44px] flex-1 !py-2 text-sm">Accept</button>
                        <button onClick={() => handleBooking(b.id, "reject")} className="btn-outline min-h-[44px] flex-1 !py-2 text-sm">Reject</button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <Link href="/bookings" className="mt-3 inline-flex text-xs font-semibold text-brand-700 hover:underline">View all bookings →</Link>
          </section>

          <section className="card p-5">
            <h2 className="flex items-center gap-2 font-bold"><Settings className="h-4 w-4" /> How vehicle availability works</h2>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-ink-mute">
              <li><strong>Not Available Today</strong> hides that vehicle from search for today only — it reappears tomorrow unless another block exists.</li>
              <li>Use <strong>Calendar → Mark Unavailable</strong> to block a date range (e.g. 10 Sep → 12 Sep) with a reason.</li>
              <li>Search checks availability server-side: <code className="rounded bg-paper px-1 font-mono text-[11px]">VehicleAvailability</code> + <code className="rounded bg-paper px-1 font-mono text-[11px]">Booking</code> conflicts exclude the vehicle; AI also uses the same API.</li>
              <li>Booking validates again before creation — second concurrent request gets <code className="rounded bg-paper px-1 font-mono text-[11px]">409 JUST_BOOKED</code> inside a transaction.</li>
            </ol>
          </section>
        </div>
      </div>

      {/* Availability Calendar Modal */}
      {showAvailModal && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => { setShowAvailModal(null); setCalendarData(null); }}>
          <div className="sheet-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 flex items-center justify-between border-b bg-white px-5 py-4">
              <div>
                <h3 className="font-bold">{showAvailModal.title} — Availability</h3>
                <p className="text-xs text-ink-mute">Select dates to mark unavailable. Red = unavailable, Blue = booked, Green = maintenance</p>
              </div>
              <button onClick={() => { setShowAvailModal(null); setCalendarData(null); }} className="rounded-full p-2 hover:bg-paper"><XCircle className="h-5 w-5" /></button>
            </div>
            <AvailabilityCalendarContent vehicle={showAvailModal} data={calendarData} onChanged={() => { loadVehicles(); openAvailability(showAvailModal); }} />
          </div>
        </div>
      )}
    </div>
  );
}

function ShareRideEarnings({ provider }: { provider: Provider }) {
  const [rides, setRides] = useState<any[] | null>(null);
  useEffect(() => {
    api<{ rides: any[] }>("/api/share-rides").then((r) => {
      if (r.ok) {
        const data: any = r.data;
        const list = data.rides || data.result?.items || data.result || [];
        setRides(Array.isArray(list) ? list : []);
      } else setRides([]);
    }).catch(() => setRides([]));
  }, []);
  if (rides === null) return <div className="mt-3 skeleton h-16 w-full" />;
  const myRides = rides.filter((r: any) => r.driverPhone === provider.phone || r.driverName === provider.businessName);
  const display = myRides.length ? myRides : rides.slice(0, 2);
  const totalEarnings = display.reduce((s: number, r: any) => s + (Number(r.pricePerSeat || 0) * (Number(r.totalSeats || 0) - Number(r.availableSeats || 0))), 0);
  const totalSeatsShared = display.reduce((s: number, r: any) => s + (Number(r.totalSeats || 0) - Number(r.availableSeats || 0)), 0);
  if (display.length === 0) {
    return (
      <div className="mt-3 rounded-xl border border-ink/10 bg-white p-4 text-center">
        <p className="text-sm font-semibold">No shared rides yet</p>
        <p className="text-xs text-ink-mute">Share your next trip — e.g., Nandyal → Kurnool — and earn per seat.</p>
      </div>
    );
  }
  return (
    <div className="mt-3 grid grid-cols-3 gap-3">
      <div className="rounded-xl border border-ink/10 bg-white p-3 text-center">
        <p className="text-lg font-extrabold">{display.length}</p>
        <p className="text-xs text-ink-mute">Rides Shared</p>
      </div>
      <div className="rounded-xl border border-ink/10 bg-white p-3 text-center">
        <p className="text-lg font-extrabold">{totalSeatsShared}</p>
        <p className="text-xs text-ink-mute">Seats Filled</p>
      </div>
      <div className="rounded-xl border border-ink/10 bg-white p-3 text-center">
        <p className="text-lg font-extrabold text-emerald-700">{inr(totalEarnings)}</p>
        <p className="text-xs text-ink-mute">Earnings</p>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string | number; sub?: string; tone?: string }) {
  const toneCls = tone === "emerald" ? "text-emerald-600 bg-emerald-50" : tone === "amber" ? "text-amber-600 bg-amber-50" : tone === "red" ? "text-red-600 bg-red-50" : tone === "blue" ? "text-sky-600 bg-sky-50" : "text-ink bg-paper";
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-4">
      <div className={`grid h-8 w-8 place-items-center rounded-xl ${toneCls}`}><Icon className="h-4 w-4" /></div>
      <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="text-xl font-extrabold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-ink-mute">{sub}</p>}
    </div>
  );
}

function Step({ num, title, desc, done, active, href }: { num: number; title: string; desc: string; done?: boolean; active?: boolean; href?: string }) {
  const Inner = (
    <div className={`rounded-2xl border p-4 ${active ? "border-brand-600 bg-brand-50" : done ? "border-emerald-200 bg-emerald-50" : "border-ink/10 bg-white"}`}>
      <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${done ? "bg-emerald-600 text-white" : active ? "bg-brand-600 text-white" : "bg-paper text-ink-mute"}`}>{done ? "✓" : num}</span>
      <p className="mt-2 text-sm font-bold leading-tight">{title}</p>
      <p className="text-xs leading-snug text-ink-mute">{desc}</p>
    </div>
  );
  return href ? <Link href={href} className="block">{Inner}</Link> : Inner;
}

function AvailabilityCalendarContent({ vehicle, data, onChanged }: { vehicle: VehicleEnriched; data: { availabilities: any[]; bookings: any[] } | null; onChanged: () => void }) {
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("PERSONAL_USE");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);

  async function mark() {
    setBusy(true);
    setErr(null);
    const r = await api(`/api/providers/vehicles/${vehicle.id}/availability`, { json: { startDate: start, endDate: end, reason, note } });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error || "Failed to mark unavailable");
    setNote("");
    onChanged();
  }

  async function remove(id: string) {
    if (!confirm("Remove this unavailable period? Vehicle will become available again.")) return;
    const r = await api(`/api/providers/vehicles/${vehicle.id}/availability/${id}`, { method: "DELETE" });
    if (!r.ok) return alert(r.data.error || "Failed");
    onChanged();
  }

  // Build 35-day mini calendar
  const days: { date: Date; iso: string; status: "available" | "unavailable" | "maintenance" | "booked" }[] = [];
  const startCal = new Date();
  startCal.setDate(startCal.getDate() - 2);
  for (let i = 0; i < 35; i++) {
    const d = new Date(startCal);
    d.setDate(startCal.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    let status: any = "available";
    if (data) {
      for (const a of data.availabilities) {
        const s = new Date(a.startDate).toISOString().slice(0, 10);
        const e = new Date(a.endDate).toISOString().slice(0, 10);
        if (iso >= s && iso <= e) {
          status = a.status === "MAINTENANCE" ? "maintenance" : "unavailable";
          break;
        }
      }
      if (status === "available") {
        for (const b of data.bookings) {
          if (!b.scheduledFor) continue;
          const bi = new Date(b.scheduledFor).toISOString().slice(0, 10);
          if (bi === iso) { status = "booked"; break; }
        }
      }
    }
    days.push({ date: d, iso, status });
  }

  return (
    <div className="space-y-5 px-5 py-5">
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <span key={d} className="font-bold text-ink-faint">{d}</span>)}
        {days.map((d) => {
          const isStart = d.date.getDay() === 0 && days.indexOf(d) !== 0;
          return (
            <div
              key={d.iso}
              className={`rounded-xl border p-1 text-xs font-medium ${d.status === "unavailable" ? "border-amber-200 bg-amber-100 text-amber-900" : d.status === "maintenance" ? "border-red-200 bg-red-100 text-red-800" : d.status === "booked" ? "border-sky-200 bg-sky-100 text-sky-800" : "border-ink/5 bg-white text-ink"} ${d.iso === todayStr ? "ring-1 ring-brand-500" : ""}`}
            >
              <span className="block font-bold">{d.date.getDate()}</span>
              <span className="block text-[10px]">{d.date.toLocaleDateString("en-IN", { month: "short" })}</span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-white border" /> Available</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-100 border border-amber-200" /> Unavailable</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-sky-100 border border-sky-200" /> Booked</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-100 border border-red-200" /> Maintenance</span>
      </div>

      <div className="rounded-2xl border border-ink/10 bg-paper p-4">
        <h4 className="font-bold">Vehicle Availability — {vehicle.title}</h4>
        <p className="text-xs text-ink-mute">Mark as not available for specific dates. Vehicle remains in your account and becomes available automatically after the selected range.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { label: "Today", get: () => { const t = new Date().toISOString().slice(0,10); return { s: t, e: t }; } },
            { label: "Tomorrow", get: () => { const d = new Date(Date.now()+86400000).toISOString().slice(0,10); return { s: d, e: d }; } },
            { label: "Next 2 Days", get: () => { const s = new Date().toISOString().slice(0,10); const e = new Date(Date.now()+1*86400000).toISOString().slice(0,10); return { s, e }; } },
            { label: "Custom Dates", get: null as any },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => { if (opt.get) { const { s, e } = opt.get(); setStart(s); setEnd(e); } }}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${start === (opt.get ? opt.get().s : "") && end === (opt.get ? opt.get().e : "") ? "border-brand-600 bg-brand-600 text-white" : "border-ink/15 bg-white text-ink-mute hover:border-brand-400"}`}
            >
              {opt.label === "Today" && "○"} {opt.label === "Tomorrow" && "○"} {opt.label === "Next 2 Days" && "○"} {opt.label === "Custom Dates" && "○"} {opt.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start Date</label>
            <input type="date" className="input h-11" value={start} onChange={(e) => setStart(e.target.value)} min={todayStr} />
          </div>
          <div>
            <label className="label">End Date</label>
            <input type="date" className="input h-11" value={end} onChange={(e) => setEnd(e.target.value)} min={start} />
          </div>
        </div>
        <div className="mt-3">
          <label className="label">Reason</label>
          <select className="input h-11" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="PERSONAL_USE">Personal use</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="EXTERNAL_RENT">Already rented externally</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div className="mt-3">
          <label className="label">Note (optional)</label>
          <input className="input h-11" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Servicing at garage" maxLength={100} />
        </div>
        {err && <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
        <button onClick={mark} disabled={busy} className="btn-primary mt-3 w-full !py-2.5">
          {busy ? "Saving…" : start === end ? "Mark Unavailable Today" : `Mark ${start} → ${end}`}
        </button>
        <p className="mt-2 text-xs text-ink-faint">Vehicle will automatically become available after {end}. No manual re-enable needed.</p>
      </div>

      {data && (
        <div>
          <h4 className="font-bold">Existing blocks & bookings</h4>
          <div className="mt-2 space-y-2">
            {data.availabilities.length === 0 && data.bookings.length === 0 && <p className="rounded-xl bg-paper p-4 text-center text-sm text-ink-mute">No blocks or bookings yet</p>}
            {data.availabilities.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{a.reason || a.status} • {new Date(a.startDate).toLocaleDateString("en-IN")} → {new Date(a.endDate).toLocaleDateString("en-IN")}</p>
                  {a.note && <p className="truncate text-xs text-ink-mute">{a.note}</p>}
                </div>
                <button onClick={() => remove(a.id)} className="grid h-9 w-9 place-items-center rounded-full bg-white text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            {data.bookings.slice(0, 5).map((b: any) => (
              <div key={b.id} className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
                <div>
                  <p className="text-sm font-bold">Booked {b.code} • {b.status}</p>
                  <p className="text-xs text-ink-mute">{b.scheduledFor ? new Date(b.scheduledFor).toLocaleString("en-IN") : "Right now"} {b.durationDays ? `• ${b.durationDays} days` : ""}</p>
                </div>
                <span className="text-xs font-semibold text-sky-800">Cannot block — booking exists</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
