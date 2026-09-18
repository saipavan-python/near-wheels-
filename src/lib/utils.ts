export function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export function kmLabel(km: number | null | undefined): string {
  if (km == null) return "";
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export function bookingCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `NW-${s}`;
}

/** 6-digit trip OTP that the rider shows to the driver to prove identity. */
export function tripOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function json<T>(v: T): string {
  return JSON.stringify(v ?? null);
}

export function parse<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

/** Resolve a human phrase like "tomorrow", "today evening", ISO or yyyy-mm-dd to Date. */
export function resolveDatePhrase(
  phrase: string | undefined,
  now: Date = new Date()
): { date: Date; matched: boolean } {
  if (!phrase) return { date: now, matched: false };
  const p = phrase.trim().toLowerCase();
  if (p === "now" || p === "immediately") return { date: now, matched: true };
  const d = new Date(now);
  if (p.includes("tomorrow")) d.setDate(d.getDate() + 1);
  else if (p.includes("day after")) d.setDate(d.getDate() + 2);
  else if (p.includes("today") || p.includes("tonight")) {
    // keep today
  } else {
    const iso = Date.parse(phrase);
    if (!Number.isNaN(iso)) return { date: new Date(iso), matched: true };
    return { date: now, matched: false };
  }
  const timeMatch = p.match(/(\d{1,2})(:(\d{2}))?\s*(am|pm)?/);
  if (timeMatch && (p.includes("am") || p.includes("pm") || p.includes(":"))) {
    let h = parseInt(timeMatch[1], 10);
    const m = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    const ap = timeMatch[4];
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    d.setHours(h, m, 0, 0);
  } else {
    d.setHours(9, 0, 0, 0);
  }
  return { date: d, matched: true };
}
