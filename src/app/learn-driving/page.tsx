"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, Search, Star, ChevronRight, Shield, Award, Clock, GraduationCap, CarFront, Navigation, Quote, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface School {
  id: string;
  schoolName: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  verified: boolean;
  rating: number;
  ratingCount: number;
  distance: number;
  location: string;
  city: string;
  priceFrom: number;
  services: string[];
}

export default function LearnDrivingPage() {
  const [location, setLocation] = useState("");
  const [courseType, setCourseType] = useState("");
  const [transmission, setTransmission] = useState("");
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [searched, setSearched] = useState(false);

  const courseTypes = [
    { value: "BEGINNER_DRIVING", label: "Beginner", desc: "First time", icon: GraduationCap },
    { value: "MANUAL_DRIVING", label: "Manual", desc: "Stick shift", icon: CarFront },
    { value: "AUTOMATIC_DRIVING", label: "Automatic", desc: "Easy drive", icon: CarFront },
    { value: "HIGHWAY_TRAINING", label: "Highway", desc: "High speed", icon: Navigation },
    { value: "PARKING_PRACTICE", label: "Parking", desc: "Perfect park", icon: MapPin },
    { value: "DEFENSIVE_DRIVING", label: "Defensive", desc: "Safe drive", icon: Shield },
    { value: "LICENSE_PREPARATION", label: "License", desc: "Test prep", icon: BookOpen },
  ];

  const useMyLocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (p) => { setUserLat(p.coords.latitude); setUserLng(p.coords.longitude); setLocation("Current Location"); setLoading(false); },
        () => setLoading(false)
      );
    }
  };

  const searchSchools = async () => {
    if (!userLat || !userLng) {
      const lat = 15.4771, lng = 78.4807;
      setUserLat(lat); setUserLng(lng);
      setLoading(true); setSearched(true);
      try {
        const params = new URLSearchParams({ lat: String(lat), lng: String(lng), radius: "50", ...(courseType && { courseType }) });
        const r = await fetch(`/api/driving-schools?${params}`); const d = await r.json(); if (d.ok) setSchools(d.schools);
      } catch {}
      setLoading(false);
      return;
    }
    setLoading(true); setSearched(true);
    try {
      const params = new URLSearchParams({ lat: String(userLat), lng: String(userLng), radius: "50", ...(courseType && { courseType }) });
      const r = await fetch(`/api/driving-schools?${params}`); const d = await r.json(); if (d.ok) setSchools(d.schools);
    } catch {}
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-paper">
      {/* Hero — premium ink with quotation */}
      <section className="relative overflow-hidden bg-ink text-white">
        <img src="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1400&h=700&fit=crop&q=80" alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
        <div className="container-nw relative py-10 sm:py-14">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-brand-300 ring-1 ring-white/15 backdrop-blur">
              <Award className="h-3.5 w-3.5" /> Certified instructors • Trusted schools
            </p>
            <h1 className="mt-3 font-display text-[32px] font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              Learn to drive <br /><span className="text-brand-400">with confidence.</span>
            </h1>
            {/* Quotation — best of best, from old code */}
            <motion.blockquote
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="relative mt-4 max-w-xl rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur sm:p-5"
            >
              <Quote className="absolute -top-3 -left-2 h-8 w-8 rounded-full bg-brand-500 p-1.5 text-white shadow-md" />
              <p className="font-display text-lg font-bold leading-snug text-white sm:text-xl">
                “Start your driving journey — become a safe, skilled driver.”
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                Connect with certified instructors and premium schools near you. Your journey to the road starts here.
              </p>
            </motion.blockquote>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/80 ring-1 ring-white/10"><Shield className="h-3.5 w-3.5 text-emerald-400" /> Verified</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/80 ring-1 ring-white/10"><Star className="h-3.5 w-3.5 text-amber-400" /> 4.8 avg</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/80 ring-1 ring-white/10"><Clock className="h-3.5 w-3.5" /> Flexible slots</span>
            </div>
          </motion.div>

          {/* Search — premium card, sticky on mobile */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.12 }} className="card sticky top-[72px] z-20 mt-6 p-4 shadow-lift sm:static sm:mt-8 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-[1.2fr_0.9fr_0.9fr_auto]">
              <label className="block">
                <span className="label">Location</span>
                <div className="flex gap-2">
                  <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City or area" className="input h-12 flex-1" />
                  <button onClick={useMyLocation} disabled={loading} className="btn-outline h-12 shrink-0 !px-3 !py-2">
                    <MapPin className="h-4 w-4" /> My location
                  </button>
                </div>
              </label>
              <label className="block">
                <span className="label">Course</span>
                <select value={courseType} onChange={(e) => setCourseType(e.target.value)} className="input h-12">
                  <option value="">All courses</option>
                  {courseTypes.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="label">Transmission</span>
                <select value={transmission} onChange={(e) => setTransmission(e.target.value)} className="input h-12">
                  <option value="">Any</option>
                  <option value="MANUAL">Manual</option>
                  <option value="AUTOMATIC">Automatic</option>
                </select>
              </label>
              <div className="flex items-end">
                <button onClick={searchSchools} disabled={loading} className="btn-primary h-12 w-full !py-3 text-base font-bold active:scale-[0.98] sm:w-auto sm:!px-6">
                  <Search className="h-4 w-4" /> {loading ? "Searching..." : "Find schools"}
                </button>
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-ink-faint sm:text-left">We search within 50km and show nearest verified schools first.</p>
          </motion.div>
        </div>
      </section>

      {/* CTA — brand */}
      <section className="border-y border-ink/5 bg-white py-6">
        <div className="container-nw flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-600">For owners</p>
            <h2 className="mt-1 font-display text-lg font-bold">Run a driving school?</h2>
            <p className="text-sm text-ink-mute">List courses and get bookings — verified in 1–2 days.</p>
          </div>
          <Link href="/driving-school/register" className="btn-primary h-12 shrink-0 !px-6 !py-3">Register Your School <ChevronRight className="h-4 w-4" /></Link>
        </div>
      </section>

      {/* Popular courses — premium */}
      {!searched && (
        <section className="py-10 sm:py-14">
          <div className="container-nw">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow">Popular</p>
              <h2 className="section-title mt-2">Explore courses</h2>
              <p className="mt-2 text-sm text-ink-mute">Tap a course to find nearby schools — we’ll use your location.</p>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
              {courseTypes.map((c) => {
                const Icon = c.icon;
                return (
                  <motion.button
                    key={c.value}
                    onClick={() => { setCourseType(c.value); useMyLocation(); setTimeout(searchSchools, 400); }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="group flex flex-col items-center rounded-2xl border border-ink/10 bg-white p-4 text-center shadow-sm transition hover:border-brand-300 hover:shadow-md"
                  >
                    <span className="grid h-12 w-12 place-items-center rounded-xl bg-ink text-white transition group-hover:bg-brand-500">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="mt-3 text-sm font-bold leading-tight">{c.label}</span>
                    <span className="text-xs text-ink-faint">{c.desc}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Results */}
      <AnimatePresence mode="wait">
        {searched && (
          <motion.section key="results" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="py-8 sm:py-10">
            <div className="container-nw">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{schools.length === 0 ? "No schools found" : `${schools.length} schools near you`}</h2>
                  <p className="mt-1 text-sm text-ink-mute">{schools.length ? "Verified • Rated • Within 50km" : "Try a different course or expand search"}</p>
                </div>
                {schools.length > 0 && <button onClick={() => setSearched(false)} className="btn-outline h-11 !px-4">Modify search</button>}
              </div>
              {schools.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card mt-6 p-10 text-center">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-paper"><Search className="h-6 w-6 text-ink-faint" /></div>
                  <h3 className="mt-3 font-bold">No schools in this area yet</h3>
                  <p className="mx-auto mt-1 max-w-md text-sm text-ink-mute">Expand search or try another course.</p>
                  <button onClick={() => setSearched(false)} className="btn-primary mt-4 !py-2.5">Back to search</button>
                </motion.div>
              ) : (
                <motion.div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}>
                  {schools.map((s) => (
                    <motion.div key={s.id} variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } } }} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                      <Link href={`/learn-driving/schools/${s.id}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-card transition hover:shadow-lift">
                        <div className="relative h-36 overflow-hidden bg-paper">
                          {s.coverImageUrl ? <img src={s.coverImageUrl} alt={s.schoolName} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" loading="lazy" /> : <div className="grid h-full place-items-center bg-gradient-to-br from-ink via-ink-soft to-brand-900/40"><GraduationCap className="h-10 w-10 text-white/70" /></div>}
                          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/45 to-transparent" />
                          {s.verified && <span className="absolute right-3 top-3 badge bg-emerald-500 text-white px-2.5 py-1"><Shield className="h-3 w-3" /> Verified</span>}
                          <span className="absolute bottom-3 left-3 badge bg-white/90 text-ink px-2.5 py-1 backdrop-blur"><MapPin className="h-3 w-3 text-brand-600" />{s.distance.toFixed(1)}km</span>
                        </div>
                        <div className="flex flex-1 flex-col p-4">
                          <div className="flex items-start gap-3">
                            {s.logoUrl ? <img src={s.logoUrl} alt="" className="h-10 w-10 rounded-xl border border-ink/10 object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white font-bold">{s.schoolName[0]}</span>}
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate font-display text-base font-bold leading-tight">{s.schoolName}</h3>
                              <p className="truncate text-xs text-ink-mute">{s.city} • {s.services.slice(0,2).join(", ") || "Driving"}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{s.rating.toFixed(1)} <span className="font-medium text-amber-700">({s.ratingCount})</span></span>
                            <span className="text-xs text-ink-faint">{s.priceFrom ? `From ₹${s.priceFrom.toLocaleString()}` : "Ask price"}</span>
                          </div>
                          <div className="mt-4 flex items-center justify-between border-t border-ink/5 pt-3">
                            <span className="text-sm font-bold text-brand-700">View school</span>
                            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-white transition group-hover:bg-brand-500"><ChevronRight className="h-4 w-4" /></span>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
