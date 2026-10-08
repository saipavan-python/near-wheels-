"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, ArrowRight, Mail, Lock, Eye, EyeOff, User, Building2 } from "lucide-react";
import { api } from "@/lib/ui";
import GoogleLoginButton from "./GoogleLoginButton";

function safeReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return null;
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

/**
 * ONE LOGIN — clean, Airbnb/Uber-inspired
 * Supports explicit account role selection (As Customer vs As Provider)
 * plus direct Super Admin quick login for platform oversight.
 */
export default function LoginForm({ onDone }: { onDone?: () => void }) {
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [step, setStep] = useState<"form" | "otp-verify" | "register">("form");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Account intent choice when signing up: CUSTOMER vs PROVIDER
  const [registerRole, setRegisterRole] = useState<"CUSTOMER" | "PROVIDER">("CUSTOMER");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [loggedInUser, setLoggedInUser] = useState<{ name?: string | null; email?: string | null; phone?: string | null; role: string } | null>(null);

  async function sendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await api("/api/auth/otp", { json: { phone } });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error || "Could not send OTP.");
    if (r.data.devCode) setCode(r.data.devCode);
    setMsg(r.data.message || "OTP sent.");
    setStep("otp-verify");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await api("/api/auth/otp", { method: "PUT", json: { phone, code, name } });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error || "Invalid OTP");
    handleSuccess(r.data.user);
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const isEmail = identifier.includes("@");
    const payload: any = { password };
    if (isEmail) payload.email = identifier.trim();
    else payload.phone = identifier.replace(/\D/g, "");
    const r = await api("/api/auth/login", { json: payload });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error || "Login failed");
    handleSuccess(r.data.user);
  }

  async function handlePasswordRegister(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const payload: any = {
      name: registerName.trim(),
      password: registerPassword,
      role: registerRole,
    };
    if (registerEmail.trim()) payload.email = registerEmail.trim();
    if (registerPhone.trim()) payload.phone = registerPhone.replace(/\D/g, "");
    if (!payload.email && !payload.phone) {
      setBusy(false);
      return setErr("Email or phone is required");
    }
    const r = await api("/api/auth/register", { json: payload });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error || "Registration failed");
    
    // If provider selected, guide to onboarding or workspace
    if (registerRole === "PROVIDER") {
      window.location.href = "/provider/onboarding";
      return;
    }
    handleSuccess(r.data.user);
  }

  

  function handleSuccess(user: any) {
    setLoggedInUser(user);
    window.dispatchEvent(new Event("nw:auth"));
    try {
      const pending = sessionStorage.getItem("nw_pending_booking");
      if (pending) window.dispatchEvent(new CustomEvent("nw:auth-booking-pending", { detail: JSON.parse(pending) }));
      
      const searchParams = new URLSearchParams(window.location.search);
      const returnTo = safeReturnTo(searchParams.get("returnTo") || searchParams.get("next") || sessionStorage.getItem("nw_redirect_next"));
      sessionStorage.removeItem("nw_redirect_next");
      if (returnTo && returnTo !== window.location.pathname) {
        setTimeout(() => { window.location.href = returnTo; }, 500);
        setTimeout(() => onDone?.(), 700);
        return;
      }
      const role = String(user?.role || "CUSTOMER").toUpperCase();
      if (role === "ADMIN") {
        setTimeout(() => { window.location.href = "/admin"; }, 600);
        setTimeout(() => onDone?.(), 800);
      } else if (role === "PROVIDER") {
        setTimeout(() => { window.location.href = "/provider/dashboard"; }, 600);
        setTimeout(() => onDone?.(), 800);
      } else {
        const isLoginPage = window.location.pathname === "/login";
        if (isLoginPage) setTimeout(() => { window.location.href = "/account"; }, 600);
        else setTimeout(() => onDone?.(), 800);
      }
    } catch {
      setTimeout(() => onDone?.(), 800);
    }
  }

  if (loggedInUser) {
    const isAdmin = loggedInUser.role === "ADMIN";
    const isProvider = loggedInUser.role === "PROVIDER";
    return (
      <div className="text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-600">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h2 className="mt-3 font-display text-lg font-bold">
          {isAdmin ? "Welcome, Super Admin" : isProvider ? "Welcome back, Provider" : `Welcome, ${loggedInUser.name || "Customer"}!`}
        </h2>
        <p className="mt-1 text-sm text-ink-mute">
          Role: <span className="font-bold text-ink">{loggedInUser.role}</span> • {loggedInUser.email || loggedInUser.phone}
        </p>
        <p className="mt-4 text-xs font-bold text-brand-600 animate-pulse">Redirecting to workspace…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <h2 className="font-display text-xl font-bold tracking-tight">Log in or create account</h2>
        <p className="mt-1 text-xs text-ink-mute">Choose Customer or Provider role for your workspace</p>
      </div>

      {/* Google login */}
      <div>
        <GoogleLoginButton onSuccess={() => {}} />
      </div>

      <div className="my-2 flex items-center gap-3">
        <span className="h-px flex-1 bg-ink/10" />
        <span className="rounded-full border border-ink/10 bg-white px-2 py-0.5 text-xs font-semibold text-ink-faint">OR</span>
        <span className="h-px flex-1 bg-ink/10" />
      </div>

      {/* Tabs */}
      <div className="flex rounded-full bg-paper p-1">
        <button
          type="button"
          onClick={() => { setMode("password"); setStep("form"); setErr(null); }}
          className={`flex-1 rounded-full py-2 text-xs font-bold transition ${mode === "password" ? "bg-white shadow-sm text-ink" : "text-ink-mute hover:text-ink"}`}
        >
          Password Login
        </button>
        <button
          type="button"
          onClick={() => { setMode("otp"); setStep("form"); setErr(null); }}
          className={`flex-1 rounded-full py-2 text-xs font-bold transition ${mode === "otp" ? "bg-white shadow-sm text-ink" : "text-ink-mute hover:text-ink"}`}
        >
          One-Time Code
        </button>
      </div>

      {/* Forms */}
      {step === "register" ? (
        <form onSubmit={handlePasswordRegister} className="space-y-3">
          {/* Account Role Selector */}
          <div>
            <label className="label">I want to register as *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRegisterRole("CUSTOMER")}
                className={`flex flex-col items-center justify-center rounded-2xl border p-3 text-center transition ${
                  registerRole === "CUSTOMER"
                    ? "border-brand-600 bg-brand-50 text-brand-900 font-bold ring-2 ring-brand-400"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <User className="h-5 w-5 mb-1 text-brand-600" />
                <span className="text-xs font-bold">As Customer</span>
                <span className="text-[10px] text-slate-500">Rent & Book Rides</span>
              </button>

              <button
                type="button"
                onClick={() => setRegisterRole("PROVIDER")}
                className={`flex flex-col items-center justify-center rounded-2xl border p-3 text-center transition ${
                  registerRole === "PROVIDER"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-2 ring-emerald-400"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                <Building2 className="h-5 w-5 mb-1 text-emerald-600" />
                <span className="text-xs font-bold">As Provider</span>
                <span className="text-[10px] text-slate-500">List Fleet & Earn</span>
              </button>
            </div>
          </div>

          <input placeholder="Full Name *" value={registerName} onChange={(e) => setRegisterName(e.target.value)} className="input h-11 text-xs" required maxLength={60} />
          <input type="email" placeholder="Email Address" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} className="input h-11 text-xs" />
          <div className="flex items-center gap-2 rounded-xl border border-ink/15 bg-white px-3">
            <span className="text-xs font-semibold text-ink-mute">+91</span>
            <input inputMode="numeric" placeholder="Phone (10-digit mobile)" value={registerPhone} onChange={(e) => setRegisterPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} className="w-full bg-transparent py-2.5 text-xs outline-none font-medium" />
          </div>
          <div className="relative">
            <input type={showPassword ? "text" : "password"} placeholder="Password (min 8 chars) *" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} className="input h-11 pr-10 text-xs" required minLength={8} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1.5 grid h-8 w-8 place-items-center rounded-lg hover:bg-paper">
              {showPassword ? <EyeOff className="h-4 w-4 text-slate-400" /> : <Eye className="h-4 w-4 text-slate-400" />}
            </button>
          </div>

          <button type="submit" disabled={busy || !registerPassword || (!registerEmail && !registerPhone)} className="btn-primary w-full !rounded-xl !py-3 text-xs font-bold shadow-md">
            {busy ? "Creating Account…" : `Create ${registerRole === "PROVIDER" ? "Provider" : "Customer"} Account`}
          </button>
          <p className="text-center text-xs text-ink-mute">
            Already registered? <button type="button" onClick={() => setStep("form")} className="font-bold text-brand-700 hover:underline">Log in</button>
          </p>
        </form>
      ) : mode === "password" ? (
        <form onSubmit={handlePasswordLogin} className="space-y-3">
          <div>
            <label className="label" htmlFor="pw-id">Mobile phone or email</label>
            <input id="pw-id" placeholder="10-digit mobile or email@domain.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="input h-11 text-xs" required autoComplete="username" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label mb-0" htmlFor="pw-pass">Password</label>
              <Link href="/forgot-password" className="text-xs font-semibold text-slate-400 hover:text-brand-700">Forgot?</Link>
            </div>
            <div className="relative">
              <input id="pw-pass" type={showPassword ? "text" : "password"} placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} className="input h-11 pr-10 text-xs" required minLength={8} autoComplete="current-password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1.5 grid h-8 w-8 place-items-center rounded-lg hover:bg-paper" aria-label="Toggle password">
                {showPassword ? <EyeOff className="h-4 w-4 text-slate-400" /> : <Eye className="h-4 w-4 text-slate-400" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={busy || !identifier || !password} className="btn-primary w-full !rounded-xl !py-3 text-xs font-bold shadow-md">
            {busy ? "Signing in…" : "Log in"}
          </button>

          <p className="text-center text-xs text-ink-mute">
            New here? <button type="button" onClick={() => setStep("register")} className="font-bold text-brand-700 hover:underline">Create account (As Customer / Provider)</button>
          </p>
        </form>
      ) : step === "otp-verify" ? (
        <form onSubmit={verify} className="space-y-3">
          <div>
            <label htmlFor="nw-code" className="label">Enter code sent to +91 {phone}</label>
            <input id="nw-code" inputMode="numeric" autoFocus placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="input h-11 text-center text-base font-bold tracking-[0.4em]" required />
            {msg && <p className="mt-1 text-xs text-emerald-700 font-semibold">{msg}</p>}
          </div>
          <input placeholder="Your name (new users)" value={name} onChange={(e) => setName(e.target.value)} className="input h-11 text-xs" maxLength={40} />
          <button type="submit" disabled={busy || code.length !== 6} className="btn-primary w-full !rounded-xl !py-3 text-xs font-bold shadow-md">
            {busy ? "Verifying…" : "Verify & Continue"}
          </button>
          <button type="button" onClick={() => { setStep("form"); setCode(""); setMsg(null); }} className="w-full text-center text-xs font-semibold text-slate-500 hover:text-brand-700">
            Change number
          </button>
        </form>
      ) : (
        <form onSubmit={sendOtp} className="space-y-3">
          <div>
            <label htmlFor="nw-phone" className="label">Mobile Phone Number</label>
            <div className="flex items-center gap-2 rounded-xl border border-ink/15 bg-white px-3 focus-within:border-brand-500">
              <span className="text-xs font-semibold text-slate-500">+91</span>
              <input id="nw-phone" inputMode="numeric" autoComplete="tel" placeholder="10-digit mobile number" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} className="w-full bg-transparent py-2.5 text-xs font-bold outline-none" required minLength={10} />
            </div>
          </div>
          <button type="submit" disabled={busy || phone.length !== 10} className="btn-primary w-full !rounded-xl !py-3 text-xs font-bold shadow-md">
            {busy ? "Sending Code…" : <>Continue with OTP <ArrowRight className="h-4 w-4" /></>}
          </button>
        </form>
      )}

      {err && <p className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{err}</p>}

      <p className="flex items-center justify-center gap-1 text-center text-[11px] font-semibold text-slate-400 pt-1">
        <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
        <span>One account for Customer, Provider & Admin</span>
      </p>
    </div>
  );
}
