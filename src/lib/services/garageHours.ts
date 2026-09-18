/**
 * Garage opening-hours engine (spec: hours-driven availability).
 *
 * A garage's "available now" status is derived automatically from its
 * registered opening/closing times — the provider does NOT have to flip a
 * switch every morning/night. Manual OFFLINE / MAINTENANCE still overrides
 * (opt-out), because those are deliberate provider actions.
 */

export interface GarageHoursInput {
  open24x7?: boolean | null;
  opensAt?: string | null; // "HH:MM" (24h)
  closesAt?: string | null;
  services?: string | string[] | null; // JSON string or array of service tokens
}

export interface GarageStatus {
  /** Should the garage be treated as available right now? */
  open: boolean;
  /** Short pill label: "Open now" | "Closed now" | "24×7" */
  label: string;
  /** Human detail, e.g. "Closes at 9:00 PM", "Opens at 6:00 AM" */
  detail: string;
  /** Garage offers emergency / roadside response */
  emergency: boolean;
  /** Minutes since midnight (null if unset/24×7) */
  opensMin: number | null;
  closesMin: number | null;
}

const EMERGENCY_TOKENS = ["EMERGENCY", "BREAKDOWN", "BATTERY", "TOWING"];

export function garageServices(profile: GarageHoursInput): string[] {
  const raw = profile.services;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // not JSON — treat as comma/pipe separated
    }
    return t.split(/[,|]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export function hasEmergencyServices(services: string[]): boolean {
  return services.some((s) => EMERGENCY_TOKENS.includes(s));
}

/** Parse "HH:MM" / "H:MM" to minutes since midnight, or null when invalid. */
export function minutesOf(time: string | null | undefined): number | null {
  if (!time) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function fmtTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

/**
 * Compute live open/closed state.
 *
 * @param profile    GarageProfile-like object (hours + services)
 * @param provider   { status, availabilityStatus } of the owning Provider
 * @param now        current moment (injectable for tests)
 */
export function garageStatus(
  profile: GarageHoursInput,
  provider: { status?: string; availabilityStatus?: string },
  now: Date = new Date()
): GarageStatus {
  const services = garageServices(profile);
  const emergency = hasEmergencyServices(services);
  const baseActive = (provider.status ?? "ACTIVE") === "ACTIVE";
  const manuallyOff =
    provider.availabilityStatus === "OFFLINE" || provider.availabilityStatus === "MAINTENANCE";

  // 24×7 garages are always open unless the provider opts out manually.
  if (profile.open24x7) {
    return {
      open: baseActive && !manuallyOff,
      label: "24×7",
      detail: "Open 24×7",
      emergency,
      opensMin: null,
      closesMin: null,
    };
  }

  const os = minutesOf(profile.opensAt);
  const cs = minutesOf(profile.closesAt);

  // Hours configured → time governs, automatically on/off.
  if (os != null && cs != null) {
    const cur = now.getHours() * 60 + now.getMinutes();
    let open: boolean;
    let detail: string;
    if (cs > os) {
      // normal window, e.g. 08:00 → 21:00
      open = cur >= os && cur < cs;
      detail = open
        ? `Closes at ${fmtTime(cs)}`
        : cur < os
          ? `Opens at ${fmtTime(os)} today`
          : `Opens at ${fmtTime(os)} tomorrow`;
    } else {
      // overnight window, e.g. 20:00 → 06:00
      open = cur >= os || cur < cs;
      detail = open
        ? `Closes at ${fmtTime(cs)}`
        : `Opens at ${fmtTime(os)} today`;
    }
    return {
      open: baseActive && !manuallyOff && open,
      label: open ? "Open now" : "Closed now",
      detail,
      emergency,
      opensMin: os,
      closesMin: cs,
    };
  }

  // No hours registered → fall back to the provider's manual availability.
  const open = baseActive && provider.availabilityStatus === "AVAILABLE_NOW";
  return {
    open,
    label: open ? "Open now" : "Closed now",
    detail: open ? "Marked available" : "Available on request",
    emergency,
    opensMin: null,
    closesMin: null,
  };
}