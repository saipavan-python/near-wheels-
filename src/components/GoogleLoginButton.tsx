"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/ui";

function safeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return null;
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

declare global {
  interface Window {
    google?: any;
  }
}

export default function GoogleLoginButton({ onSuccess, label = "Continue with Google" }: { onSuccess?: () => void; label?: string }) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const btnRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    api<{ configured: boolean; clientId?: string }>("/api/auth/google").then((r) => {
      if (r.ok) {
        setConfigured(r.data.configured);
        if (r.data.configured && r.data.clientId) setClientId(r.data.clientId);
      } else {
        setConfigured(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!clientId || !btnRef.current || initialized.current) return;
    // Load GIS script
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    const init = () => {
      if (!window.google || initialized.current) return;
      initialized.current = true;
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        // Render official button
        if (btnRef.current) {
          window.google.accounts.id.renderButton(btnRef.current, {
            theme: "outline",
            size: "large",
            width: 320,
            text: "continue_with",
            shape: "pill",
          });
        }
        // Also enable One Tap if desired (optional, disabled to avoid intrusive)
        // window.google.accounts.id.prompt();
      } catch (e) {
        console.error("GIS init failed");
      }
    };

    const handleCredential = async (resp: { credential: string }) => {
      setLoading(true);
      setErr(null);
      try {
        const r = await api("/api/auth/google", { json: { idToken: resp.credential } });
        setLoading(false);
        if (!r.ok) {
          setErr(r.data.error || "Google login failed");
          return;
        }
        window.dispatchEvent(new Event("nw:auth"));
        // Handle pending booking redirect
        try {
          const next = safeReturnTo(sessionStorage.getItem("nw_redirect_next"));
          if (next) {
            sessionStorage.removeItem("nw_redirect_next");
            setTimeout(() => { window.location.href = next; }, 100);
          }
        } catch {}
        onSuccess?.();
      } catch {
        setLoading(false);
        setErr("Network error");
      }
    };

    if (existing && window.google) {
      init();
    } else if (!existing) {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = init;
      s.onerror = () => setErr("Failed to load Google login");
      document.head.appendChild(s);
    }
  }, [clientId]);

  if (configured === false) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
        Google login not configured. Set <code className="rounded bg-white px-1 font-mono">GOOGLE_CLIENT_ID</code> in .env to enable.
      </div>
    );
  }

  if (!clientId) {
    return <div className="skeleton h-11 w-full rounded-full" />;
  }

  return (
    <div className="w-full">
      <div ref={btnRef} className="flex w-full justify-center" aria-label={label} />
      {/* Fallback manual button if GIS fails */}
      <noscript>
        <p className="text-xs text-red-600">Enable JavaScript for Google login</p>
      </noscript>
      {loading && <p className="mt-2 text-center text-xs text-ink-mute">Verifying with Googleâ€¦</p>}
      {err && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>}
      <p className="mt-2 text-center text-[11px] text-ink-faint">Secure Google sign-in Â· We never store your Google password</p>
    </div>
  );
}
