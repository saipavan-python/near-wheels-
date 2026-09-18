"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldCheck, ArrowRight, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/ui";

export default function ForgotPasswordForm() {
  const [step, setStep] = useState<"phone" | "verify" | "done">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    const r = await api("/api/auth/forgot", { json: { phone } });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error || "Could not send OTP.");
    setMsg(r.data.message || "OTP sent.");
    setStep("verify");
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await api("/api/auth/forgot", { method: "PUT", json: { phone, code, newPassword } });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error || "Could not reset password.");
    setMsg(r.data.message || "Password updated.");
    setStep("done");
  }

  if (step === "done") {
    return (
      <div className="text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="mt-3 font-display text-lg font-bold">Password updated</h2>
        <p className="mt-1 text-sm text-ink-mute">{msg}</p>
        <Link href="/login" className="btn-primary mt-5 inline-flex w-full justify-center !rounded-xl !py-3 text-xs font-bold">
          Log in with new password <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="font-display text-xl font-bold tracking-tight">Reset your password</h2>
        <p className="mt-1 text-xs text-ink-mute">
          {step === "phone"
            ? "We'll send a one-time code to your registered mobile number."
            : `Enter the OTP sent to +91 ${phone} and choose a new password.`}
        </p>
      </div>

      {step === "phone" ? (
        <form onSubmit={requestOtp} className="space-y-3">
          <div>
            <label htmlFor="fp-phone" className="label">Mobile Phone Number</label>
            <div className="flex items-center gap-2 rounded-xl border border-ink/15 bg-white px-3 focus-within:border-brand-500">
              <span className="text-xs font-semibold text-slate-500">+91</span>
              <input
                id="fp-phone"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className="w-full bg-transparent py-2.5 text-xs font-bold outline-none"
                required
                minLength={10}
              />
            </div>
          </div>
          <button type="submit" disabled={busy || phone.length !== 10} className="btn-primary w-full !rounded-xl !py-3 text-xs font-bold shadow-md">
            {busy ? "Sending Code…" : <>Send OTP <ArrowRight className="h-4 w-4" /></>}
          </button>
        </form>
      ) : (
        <form onSubmit={resetPassword} className="space-y-3">
          <div>
            <label htmlFor="fp-code" className="label">One-time code</label>
            <input
              id="fp-code"
              inputMode="numeric"
              autoFocus
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="input h-11 text-center text-base font-bold tracking-[0.4em]"
              required
            />
            {msg && <p className="mt-1 text-xs font-semibold text-emerald-700">{msg}</p>}
          </div>
          <div>
            <label htmlFor="fp-pass" className="label">New password</label>
            <div className="relative">
              <input
                id="fp-pass"
                type={showPassword ? "text" : "password"}
                placeholder="Min 8 chars, upper + lower + number"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input h-11 pr-10 text-xs"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1.5 grid h-8 w-8 place-items-center rounded-lg hover:bg-paper" aria-label="Toggle password">
                {showPassword ? <EyeOff className="h-4 w-4 text-slate-400" /> : <Eye className="h-4 w-4 text-slate-400" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={busy || code.length !== 6 || newPassword.length < 8} className="btn-primary w-full !rounded-xl !py-3 text-xs font-bold shadow-md">
            {busy ? "Updating…" : "Set new password"}
          </button>
          <button type="button" onClick={() => { setStep("phone"); setCode(""); setNewPassword(""); setMsg(null); setErr(null); }} className="w-full text-center text-xs font-semibold text-slate-500 hover:text-brand-700">
            Change number
          </button>
        </form>
      )}

      {err && <p className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{err}</p>}

      <p className="flex items-center justify-center gap-1 text-center text-[11px] font-semibold text-slate-400 pt-1">
        <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
        <span>OTP only goes to your registered mobile number</span>
      </p>
    </div>
  );
}