"use client";

// Shared client-side helpers for the Near Wheels UI.
import type { ResultCard, PriceQuote, SearchResult } from "./types";

export type { ResultCard, PriceQuote, SearchResult };

export interface PublicBooking {
  id: string;
  code: string;
  status: string;
  paymentStatus: string;
  kind: string;
  listingKind: string;
  listingTitle: string;
  providerId: string;
  providerName: string;
  scheduledFor: string | null;
  durationDays: number | null;
  durationHours: number | null;
  acres: number | null;
  estKm: number | null;
  locationText: string | null;
  distanceKm: number | null;
  etaMin: number | null;
  totalAmount: number;
  depositAmount: number | null;
  baseAmount: number;
  feesAmount: number;
  commissionAmount: number;
  breakdown?: { label: string; amount: number; note?: string }[];
  createdAt: string;
  cancelReason?: string | null;
  payments?: { id: string; status: string; amount: number; gatewayRef: string | null }[];
  review?: { rating: number; comment: string | null } | null;
  customerId?: string;
}

export function inr(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export async function api<T = any>(
  url: string,
  init?: RequestInit & { json?: unknown }
): Promise<{ ok: boolean; status: number; data: T & Record<string, any> }> {
  const opts: RequestInit = { ...init };
  if (init?.json !== undefined) {
    opts.method = init.method || "POST";
    opts.headers = { ...(init.headers || {}), "Content-Type": "application/json" };
    opts.body = JSON.stringify(init.json);
  }
  try {
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok && data?.ok !== false, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Network problem — please check your connection." } as any };
  }
}

export function newIdemKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `ui-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const STATUS_META: Record<string, { label: string; tone: "green" | "amber" | "red" | "blue" | "gray" }> = {
  AVAILABLE_NOW: { label: "Available now", tone: "green" },
  BUSY: { label: "Busy", tone: "amber" },
  SCHEDULED: { label: "Scheduled", tone: "blue" },
  OFFLINE: { label: "Offline", tone: "red" },
  MAINTENANCE: { label: "Maintenance", tone: "amber" },
};

export const BOOKING_STATUS_META: Record<string, { label: string; tone: "green" | "amber" | "red" | "blue" | "gray" }> = {
  REQUESTED: { label: "Requested", tone: "blue" },
  PENDING_PROVIDER: { label: "Waiting for provider", tone: "amber" },
  ACCEPTED: { label: "Accepted — pay to confirm", tone: "green" },
  REJECTED: { label: "Provider unavailable", tone: "red" },
  CONFIRMED: { label: "Confirmed", tone: "green" },
  EN_ROUTE: { label: "On the way", tone: "blue" },
  IN_PROGRESS: { label: "In progress", tone: "blue" },
  COMPLETED: { label: "Completed", tone: "gray" },
  CANCELLED: { label: "Cancelled", tone: "red" },
  REFUNDED: { label: "Refunded", tone: "gray" },
  DISPUTED: { label: "Disputed", tone: "red" },
};

export function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "Right now";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation)
      return reject(new Error("Location not supported on this device"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => {
        if (err && err.code === err.PERMISSION_DENIED) {
          reject(new Error("Location access is blocked. Please enable location permission in your browser settings, or search a location manually."));
        } else if (err && err.code === err.TIMEOUT) {
          reject(new Error("We couldn't detect your location in time. Please try again or search a location manually."));
        } else {
          reject(new Error("Unable to detect your location right now. Please try again or search a location manually."));
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  });
}

const RECENT_KEY = "nw_recent_locations";

export function pushRecentLocation(loc: { label: string; lat?: number; lng?: number }) {
  if (typeof window === "undefined") return;
  try {
    const arr = readRecentLocations().filter((l) => l.label !== loc.label);
    arr.unshift({ ...loc, at: Date.now() });
    localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(0, 6)));
  } catch {}
}

export function readRecentLocations(): { label: string; lat?: number; lng?: number; at?: number }[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

/** Speech recognition with graceful degradation (not all browsers support it). */
export function speechSupported(): boolean {
  return typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function listenOnce(onText: (t: string) => void, onEnd?: (err?: string) => void): () => void {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = "en-IN";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.onresult = (e: any) => {
    const t = e.results?.[0]?.[0]?.transcript || "";
    if (t) onText(t);
  };
  rec.onerror = (e: any) => onEnd?.(e?.error || "mic_error");
  rec.onend = () => onEnd?.();
  try {
    rec.start();
  } catch {
    onEnd?.("mic_error");
  }
  return () => {
    try {
      rec.stop();
    } catch {}
  };
}
