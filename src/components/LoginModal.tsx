"use client";

import { useEffect, useState } from "react";
import { IconX } from "./icons";
import LoginForm from "./LoginForm";

/** Global OTP login modal — opens via the `nw:open-login` window event. */
export default function LoginModal() {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const openFn = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.message) setMsg(detail.message);
      setOpen(true);
    };
    window.addEventListener("nw:open-login", openFn as EventListener);
    return () => window.removeEventListener("nw:open-login", openFn as EventListener);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Login to Near Wheels"
    >
      <div
        className="sheet-in w-full max-w-md overflow-hidden rounded-t-3xl bg-paper shadow-panel sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink/[0.06] px-6 py-4">
          <div>
            <h2 className="font-display text-base font-bold">Log in or sign up</h2>
            <p className="text-xs text-ink-mute">One account for customers, providers & admins</p>
          </div>
          <button
            aria-label="Close login"
            className="grid h-9 w-9 place-items-center rounded-full bg-ink/5 text-ink-mute hover:bg-ink hover:text-white"
            onClick={() => setOpen(false)}
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>
        {msg && <p className="mx-6 mt-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm font-medium text-amber-800">{msg}</p>}
        <div className="px-6 py-6 sm:px-7">
          <LoginForm onDone={() => { setMsg(null); setOpen(false); }} />
          <p className="mt-4 text-center text-xs leading-relaxed text-ink-faint">
            By continuing, you agree to Near Wheels Terms & Privacy. <br />
            <span className="font-medium text-ink-mute">One login works for everyone — we’ll route you automatically.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
