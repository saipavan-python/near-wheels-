import type { Metadata } from "next";
import Link from "next/link";
import { UserRound, CarFront, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Join Near Wheels — Choose your account",
  description: "Continue as a customer to book vehicles, or register as a provider to list your vehicles on Near Wheels.",
};

export default function RegisterChoicePage() {
  return (
    <div className="container-nw max-w-5xl py-10">
      <p className="eyebrow text-brand-600">Get started</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Join Near Wheels</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-mute">
        One account, two journeys. Pick how you want to use Near Wheels. You can always add a provider profile later from your account.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* Continue as User */}
        <div className="group relative flex flex-col rounded-3xl border border-ink/10 bg-white p-6 shadow-card transition hover:border-brand-300 hover:shadow-lift sm:p-8">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500 text-white">
            <UserRound className="h-6 w-6" />
          </span>
          <h2 className="mt-4 font-display text-xl font-bold">Continue as User</h2>
          <p className="mt-2 min-h-[48px] text-sm leading-relaxed text-ink-mute">
            Search vehicles, compare, calculate trip costs and book instantly — just a mobile number, no passwords.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-ink-soft">
            <li className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" /> Browse without account</li>
            <li className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" /> Book, pay, manage bookings</li>
            <li className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" /> Save favourites</li>
          </ul>
          <Link href="/login?intent=user" className="btn-primary mt-6 inline-flex w-full justify-center !py-3">
            Continue as User <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-center text-xs text-ink-faint">Free · OTP login · No spam</p>
        </div>

        {/* Register as Provider */}
        <div className="group relative flex flex-col rounded-3xl border border-brand-200 bg-brand-50/50 p-6 shadow-card ring-1 ring-brand-100 transition hover:border-brand-400 hover:shadow-lift sm:p-8">
          <span className="absolute right-4 top-4 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-bold text-white">Most popular</span>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-white">
            <CarFront className="h-6 w-6" />
          </span>
          <h2 className="mt-4 font-display text-xl font-bold">Register as Provider</h2>
          <p className="mt-2 min-h-[48px] text-sm leading-relaxed text-ink-mute">
            List your cars, autos, bikes, SUVs, vans and more — one account for unlimited vehicles. Start receiving bookings after verification.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-ink-soft">
            <li className="flex gap-2"><Sparkles className="h-4 w-4 shrink-0 text-brand-600" /> One account → many vehicles</li>
            <li className="flex gap-2"><Sparkles className="h-4 w-4 shrink-0 text-brand-600" /> Control availability per vehicle</li>
            <li className="flex gap-2"><Sparkles className="h-4 w-4 shrink-0 text-brand-600" /> View earnings & bookings</li>
          </ul>
          <Link href="/providers/register" className="btn-dark mt-6 inline-flex w-full justify-center !py-3">
            Register as Provider <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-center text-xs text-ink-faint">Free to list · Commission only on completed trips</p>
        </div>
      </div>

      <div className="card mt-8 flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
        <p className="text-sm text-ink-mute">
          Already have an account? <Link href="/login" className="font-semibold text-brand-700 hover:underline">Log in</Link>
        </p>
        <Link href="/vehicles" className="text-sm font-semibold text-ink-mute hover:text-brand-700">
          Continue browsing without account →
        </Link>
      </div>
    </div>
  );
}
