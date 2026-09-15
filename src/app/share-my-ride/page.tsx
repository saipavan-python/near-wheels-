"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Car,
  Search,
  ShieldCheck,
  PiggyBank,
  Users,
  Route,
  Sparkles,
  ArrowRight,
  MapPin,
  Clock,
  Star,
  CheckCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { inr } from "@/lib/ui";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { MotionCard } from "@/components/motion/MotionCard";
import {
  heroVariants,
  heroImageVariants,
  heroContentVariants,
  searchPanelVariants,
  staggerContainerVariants,
  staggerItemVariants,
  buttonHoverVariants,
  cardHoverVariants,
} from "@/lib/motion/animations";

export default function ShareMyRideLandingPage() {
  const [from, setFrom] = useState("Guntur");
  const [to, setTo] = useState("Bangalore");
  const [date, setDate] = useState("2026-08-30");
  const [passengers, setPassengers] = useState(1);
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/share-rides")
      .then((r) => r.json())
      .then((d) => {
        setRides(d.rides || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <motion.section
        className="relative overflow-hidden bg-slate-900 py-16 text-white md:py-24"
        variants={heroVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.img
          src="https://media.istockphoto.com/id/2198562674/photo/crowdsourced-taxi-driver-picking-up-a-passenger-and-smiling.jpg?s=612x612&w=0&k=20&c=_Df6CRkfTX309C700mxFk7johSYfenElhH_bJu7yod8="
          alt="Taxi driver welcoming a passenger"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-55 md:left-1/2 md:w-1/2 md:opacity-75"
          variants={heroImageVariants}
          initial="hidden"
          animate="visible"
        />
        <motion.div className="absolute inset-0 bg-slate-950/55 md:bg-gradient-to-r md:from-slate-950 md:via-slate-950/90 md:to-slate-950/20" />
        <div className="container-nw relative z-10 text-center max-w-4xl">
          <motion.span
            className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-300 backdrop-blur-md"
            variants={staggerItemVariants}
          >
            <motion.div animate={{ rotate: [0, 12, 0] }} transition={{ duration: 2, repeat: Infinity }}>
              <Sparkles className="h-4 w-4" />
            </motion.div>
            Share My Ride Module
          </motion.span>

          <motion.h1
            className="mt-6 font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl"
            variants={staggerItemVariants}
          >
            SHARE MY RIDE
          </motion.h1>
          <motion.p
            className="mt-2 text-xl font-medium text-amber-300 font-sans tracking-wide"
            variants={staggerItemVariants}
          >
            Your Wheels. Your Choice.
          </motion.p>

          <motion.p
            className="mx-auto mt-5 max-w-2xl text-base text-slate-300 md:text-lg"
            variants={staggerItemVariants}
          >
            Going somewhere? Take someone along. Share your empty seats with people travelling your way — or find a ride that matches your journey.
          </motion.p>

          {/* Action CTAs */}
          <motion.div
            className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row"
            variants={staggerContainerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div
              variants={staggerItemVariants}
              whileHover="hover"
              whileTap="tap"
            >
              <Link
                href="/share-my-ride/offer"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-8 py-4 text-base font-bold text-slate-950 shadow-lg shadow-amber-500/25 transition hover:bg-amber-400 sm:w-auto"
              >
                <motion.div
                  animate={{ x: [0, 3, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <Car className="h-5 w-5" />
                </motion.div>
                OFFER A RIDE
              </Link>
            </motion.div>
            <motion.div
              variants={staggerItemVariants}
              whileHover="hover"
              whileTap="tap"
            >
              <Link
                href="/share-my-ride/find"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-8 py-4 text-base font-bold text-white backdrop-blur-md transition hover:bg-white/20 sm:w-auto"
              >
                <Search className="h-5 w-5" />
                FIND A RIDE
              </Link>
            </motion.div>
          </motion.div>

          {/* Quick Search Widget */}
          <motion.div
            className="mt-12 rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-xl md:p-6 shadow-2xl"
            variants={searchPanelVariants}
            whileHover={{
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.3)",
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                window.location.href = `/share-my-ride/find?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${date}`;
              }}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <motion.div className="text-left" variants={staggerItemVariants}>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">Leaving From</label>
                <div className="mt-1 flex items-center rounded-xl bg-white px-3 py-2.5 text-slate-900">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0 mr-2" />
                  <input
                    type="text"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    placeholder="City / Station"
                    className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
                  />
                </div>
              </motion.div>

              <motion.div className="text-left" variants={staggerItemVariants}>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">Going To</label>
                <div className="mt-1 flex items-center rounded-xl bg-white px-3 py-2.5 text-slate-900">
                  <MapPin className="h-4 w-4 text-amber-500 shrink-0 mr-2" />
                  <input
                    type="text"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="Destination"
                    className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
                  />
                </div>
              </motion.div>

              <motion.div className="text-left" variants={staggerItemVariants}>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">Date</label>
                <div className="mt-1 flex items-center rounded-xl bg-white px-3 py-2.5 text-slate-900">
                  <Clock className="h-4 w-4 text-slate-400 shrink-0 mr-2" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-transparent text-sm font-semibold outline-none"
                  />
                </div>
              </motion.div>

              <motion.div className="flex items-end" variants={staggerItemVariants}>
                <motion.button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400"
                  whileHover="hover"
                  whileTap="tap"
                  variants={buttonHoverVariants}
                >
                  <Search className="h-4 w-4" />
                  Search Rides
                </motion.button>
              </motion.div>
            </form>
          </motion.div>
        </div>
      </motion.section>

      {/* Why Share My Ride Section */}
      <motion.section
        className="py-16 md:py-24"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        variants={staggerContainerVariants}
      >
        <ScrollReveal className="container-nw">
          <div className="text-center max-w-2xl mx-auto">
            <motion.h2
              className="font-display text-3xl font-bold tracking-tight text-slate-900 md:text-4xl"
              variants={staggerItemVariants}
            >
              Why Share My Ride?
            </motion.h2>
            <motion.p
              className="mt-3 text-slate-600"
              variants={staggerItemVariants}
            >
              Connecting car owners with travellers going the same direction for cost-effective, comfortable journeys.
            </motion.p>
          </div>

          <motion.div
            className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            variants={staggerContainerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
          >
            {[
              {
                icon: PiggyBank,
                title: "Save on travel costs",
                desc: "Share fuel and toll expenses with verified passengers to cut travel costs by up to 75%.",
              },
              {
                icon: Users,
                title: "Fill empty seats",
                desc: "Turn your empty seats into shared contributions while driving your usual routes.",
              },
              {
                icon: ShieldCheck,
                title: "Meet verified travellers",
                desc: "Identity verified, licence checked, and rated drivers and passengers for safety.",
              },
              {
                icon: Route,
                title: "Flexible routes",
                desc: "Add pickup points and intermediate stops along highways to match exact routes.",
              },
              {
                icon: CheckCircle,
                title: "Secure booking",
                desc: "Instant confirmations, seat tracking, and transparent cost-sharing platform.",
              },
              {
                icon: Sparkles,
                title: "Smart route matching",
                desc: "AI powered match score algorithm comparing origin, destination, time, and preferences.",
              },
            ].map((f, i) => (
              <motion.div
                key={i}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-brand-300"
                variants={staggerItemVariants}
                custom={i}
                whileHover={{
                  y: -5,
                  boxShadow: "0 12px 24px rgba(0, 0, 0, 0.1)",
                }}
                whileTap={{ scale: 0.98 }}
              >
                <motion.div
                  className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-600"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ duration: 0.3 }}
                >
                  <f.icon className="h-6 w-6" />
                </motion.div>
                <h3 className="mt-4 font-display text-lg font-bold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </ScrollReveal>
      </motion.section>

      {/* Featured Live Rides Section */}
      <motion.section
        className="bg-slate-100/70 py-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        variants={staggerContainerVariants}
      >
        <ScrollReveal className="container-nw">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <motion.div variants={staggerItemVariants}>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-600">Available Rides</span>
              <h2 className="mt-1 font-display text-2xl font-bold text-slate-900 md:text-3xl">
                Featured Upcoming Rides
              </h2>
            </motion.div>
            <motion.div
              variants={staggerItemVariants}
              whileHover={{ x: 5 }}
            >
              <Link
                href="/share-my-ride/find"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                View all available rides{" "}
                <motion.div animate={{ x: [0, 3, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                  <ArrowRight className="h-4 w-4" />
                </motion.div>
              </Link>
            </motion.div>
          </div>

          <motion.div
            className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            variants={staggerContainerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
          >
            {rides.slice(0, 3).map((r, idx) => (
              <MotionCard key={r.id} delay={idx * 0.05}>
                <motion.div
                  className="flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-lg h-full"
                  whileHover="hover"
                  variants={cardHoverVariants}
                >
                  <div>
                    <motion.div
                      className="flex items-center justify-between"
                      whileHover={{ scale: 1.02 }}
                    >
                      <motion.span
                        className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200"
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        95% Match Score
                      </motion.span>
                      <span className="text-xs font-semibold text-slate-500">{r.travelDate}</span>
                    </motion.div>

                    <div className="mt-4 flex items-center justify-between">
                      <div>
                        <h3 className="font-display text-lg font-bold text-slate-900">
                          {r.fromLocation} → {r.toLocation}
                        </h3>
                        <p className="text-xs text-slate-500">Departs at {r.departureTime}</p>
                      </div>
                      <motion.div className="text-right" whileHover={{ scale: 1.05 }}>
                        <span className="font-display text-xl font-extrabold text-slate-900">
                          {inr(r.pricePerSeat)}
                        </span>
                        <span className="block text-[11px] text-slate-400">/ seat</span>
                      </motion.div>
                    </div>

                    {/* Route Timeline */}
                    <motion.div
                      className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600"
                      whileHover={{ backgroundColor: "#f8fafc" }}
                    >
                      <div className="flex items-center gap-2">
                        <motion.span
                          className="h-2 w-2 rounded-full bg-emerald-500"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                        <span className="font-semibold">{r.fromLocation}</span>
                        {JSON.parse(r.stopsJson || "[]").length > 0 && (
                          <>
                            <span className="text-slate-300">→</span>
                            <span className="text-slate-400">via {JSON.parse(r.stopsJson)[0]}</span>
                          </>
                        )}
                        <span className="text-slate-300">→</span>
                        <motion.span
                          className="h-2 w-2 rounded-full bg-amber-500"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                        />
                        <span className="font-semibold">{r.toLocation}</span>
                      </div>
                    </motion.div>

                    <motion.div
                      className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4"
                      whileHover={{ scale: 1.02 }}
                    >
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 font-bold text-slate-700">
                        {r.driverName[0]}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1">
                          {r.driverName}
                          {r.verified && (
                            <motion.div
                              animate={{ scale: [1, 1.1, 1] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            >
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-600 fill-emerald-100" />
                            </motion.div>
                          )}
                        </h4>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {r.driverRating} · {r.driverTotalRides}{" "}
                          rides
                        </p>
                      </div>
                    </motion.div>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-xs font-semibold text-slate-500">
                      {r.availableSeats} of {r.totalSeats} seats left
                    </span>
                    <motion.div
                      whileHover={{
                        scale: 1.05,
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Link
                        href={`/share-my-ride/ride/${r.id}`}
                        className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
                      >
                        VIEW RIDE
                      </Link>
                    </motion.div>
                  </div>
                </motion.div>
              </MotionCard>
            ))}
          </motion.div>
        </ScrollReveal>
      </motion.section>
    </div>
  );
}
