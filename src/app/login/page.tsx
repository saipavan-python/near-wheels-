import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { IMGS } from "@/lib/imagery";
import LoginForm from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Log in — One account for everyone | Near Wheels",
  description: "Log in with Google, email/phone + password, or one-time code. One login for customers, providers and admins — we route you automatically.",
};

export default function LoginPage() {
  return (
    <div className="grid min-h-[calc(100vh-72px)] lg:grid-cols-2">
      {/* brand panel */}
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <img src={IMGS.hero} alt="" className="hero-img absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/50" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Link href="/" className="font-display text-sm font-bold uppercase tracking-[0.28em] text-white/70">
            Near Wheels
          </Link>
          <div>
            <h2 className="max-w-md font-display text-4xl font-extrabold leading-tight tracking-tight">
              Your journey.<br />Your wheels<span className="text-brand-500">.</span>
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">
              Book vehicles, professional drivers and trusted garages — with live availability,
              clear prices and secure payments.
            </p>
          </div>
          <p className="text-xs text-white/40">One login for everyone • Google • Password • One-time code</p>
        </div>
      </div>

      {/* form panel */}
      <div className="flex items-center justify-center bg-paper px-5 py-14">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-mute transition hover:text-brand-700 lg:hidden">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <div className="card p-7 shadow-lift sm:p-9">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
