/**
 * Budget / trip intent parser — extracts structured fields from free-form
 * Telugu / English / romanized mixed input WITHOUT asking LLM to do math.
 * LLM calls this via tool; this is deterministic regex + gazetteer.
 */

export interface ParsedTripIntent {
  budget?: number; // INR
  from?: string;
  to?: string;
  pax?: number; // passengers
  days?: number; // trip duration
  hours?: number;
  vehicleCategory?: string; // CAR/SUV/VAN etc
  vehicleModel?: string; // Ertiga, Innova
  withDriver?: boolean;
  roundTrip?: boolean; // true if 2 days or "round trip" mentioned
  dateText?: string; // raw date phrase
  serviceType?: string; // GARAGE, EMERGENCY etc
  languageHint?: "en" | "te" | "mixed";
}

const VEHICLE_MODELS = ["ertiga", "innova", "crysta", "dzire", "carens", "scorpio", "xylo", "traveller", "auto", "bike", "activa", "shine", "bolero", "eicher"];
const CATEGORY_MAP: Record<string, string> = {
  car: "CAR",
  auto: "AUTO",
  bike: "BIKE",
  scooter: "SCOOTER",
  suv: "SUV",
  van: "VAN",
  pickup: "PICKUP",
  truck: "TRUCK",
  bus: "BUS",
  tractor: "TRACTOR",
};

function extractBudget(text: string): number | undefined {
  // ₹10,000, 10000, 10k, 10 thousand, budget 8000
  const m =
    text.match(/₹\s*([\d,]+(?:\.\d+)?)\s*(k)?/i) ||
    text.match(/rs\.?\s*([\d,]+)/i) ||
    text.match(/budget[^0-9]*([\d,]+)/i) ||
    text.match(/([\d,]+)\s*budget/i);
  if (m) {
    let raw = m[1].replace(/,/g, "");
    let n = Number(raw);
    if (m[2]?.toLowerCase() === "k") n *= 1000;
    if (!isNaN(n) && n >= 500 && n <= 500000) return Math.round(n);
  }
  // "10k" shorthand anywhere
  const km = text.match(/\b(\d+)\s*k\b/i);
  if (km) {
    const n = Number(km[1]) * 1000;
    if (n >= 1000 && n <= 500000) return n;
  }
  return undefined;
}

function extractPax(text: string): number | undefined {
  const m =
    text.match(/(\d+)\s*(?:members?|people|persons?|pax|members?)\b/i) ||
    text.match(/(\d+)\s*members/i) ||
    text.match(/\b(\d+)\s*seats?\b/i);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 50) return n;
  }
  // Telugu "5 members" is same, already caught
  return undefined;
}

function extractDays(text: string): number | undefined {
  const m =
    text.match(/(\d+)\s*days?/i) ||
    text.match(/(\d+)\s*roju/i) || // Telugu roju = day
    text.match(/\b2\s*days\b/i);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 30) return n;
  }
  if (/tomorrow/i.test(text) || /repu/i.test(text)) return 1;
  return undefined;
}

function extractVehicle(text: string): { category?: string; model?: string } {
  const lower = text.toLowerCase();
  for (const model of VEHICLE_MODELS) {
    if (lower.includes(model)) {
      // map model to category approx
      if (["ertiga", "innova", "crysta", "dzire", "carens"].includes(model)) return { model, category: "CAR" };
      if (["scorpio", "xylo"].includes(model)) return { model, category: "SUV" };
      if (["traveller"].includes(model)) return { model, category: "VAN" };
      if (["auto"].includes(model)) return { model, category: "AUTO" };
      return { model };
    }
  }
  for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return { category: cat };
  }
  return {};
}

function extractDriver(text: string): boolean | undefined {
  const lower = text.toLowerCase();
  if (lower.includes("driver") || lower.includes("డ్రైవర్") || lower.includes("driver kavali") || lower.includes("driver kaavali")) {
    if (lower.includes("without driver") || lower.includes("self drive") || lower.includes("self-drive")) return false;
    return true;
  }
  if (lower.includes("self drive") || lower.includes("self-drive")) return false;
  return undefined;
}

function extractLocations(text: string): { from?: string; to?: string } {
  // Patterns: "Guntur నుంచి Tirupati", "Guntur to Tirupati", "Guntur -> Tirupati", "village to Guntur"
  const lower = text;

  // Telugu "నుంచి" = from — capture single place words around it (robust to budget prefix)
  const teluguSimple = lower.match(/([A-Za-z\u0C00-\u0C7F]+)\s*నుంచి\s*([A-Za-z\u0C00-\u0C7F]+)/);
  if (teluguSimple) {
    return { from: teluguSimple[1].trim(), to: teluguSimple[2].trim() };
  }
  // Telugu with possible suffix "వెళ్లాలి" after destination
  const teluguFromTo = lower.match(/(.+?)\s*నుంచి\s*(.+?)(?:\s+వెళ్లాలి|\s+vellali|\s|$)/);
  if (teluguFromTo) {
    const parts = lower.split(/నుంచి/);
    if (parts.length >= 2) {
      // Take last word before నుంచి as from, first word after as to (ignores budget prefix)
      const before = parts[0].trim().split(/\s+/).filter(Boolean);
      const after = parts[1].trim().split(/\s+/).filter(Boolean);
      const fromCand = before.length ? before[before.length - 1].replace(/[^A-Za-z\u0C00-\u0C7F]/g, "") : undefined;
      const toCand = after.length ? after[0].replace(/[^A-Za-z\u0C00-\u0C7F]/g, "") : undefined;
      if (fromCand && toCand) return { from: fromCand, to: toCand };
      const from = before.slice(-2).join(" ").trim() || undefined;
      const to = after.slice(0, 2).join(" ").trim() || undefined;
      if (from && to) return { from, to };
    }
  }

  const toMatch =
    lower.match(/(?:from\s+)?([A-Za-z\u0C00-\u0C7F]+)\s*(?:to|→|->|నుంచి)\s*([A-Za-z\u0C00-\u0C7F]+)/i) ||
    lower.match(/([A-Za-z]+)\s+to\s+([A-Za-z]+)/i);
  if (toMatch) return { from: toMatch[1].trim(), to: toMatch[2].trim() };

  // Single destination — two real patterns:
  //  EN "to X" (preposition before place) and  TE "X ki/ku/వెళ్లాలి" (dative after place).
  const withTo = lower.match(/(?:^|\s)to\s+([A-Za-z\u0C00-\u0C7F]+)/i);
  if (withTo) return { to: withTo[1].trim() };
  const dativeSuffix = lower.match(/([A-Za-z\u0C00-\u0C7F]{3,30})\s+(?:ki|ku|వెళ్లాలి)\b/i);
  if (dativeSuffix) return { to: dativeSuffix[1].trim() };

  // Village phrase "my village to Guntur"
  const village = lower.match(/(?:village|ooru|ఊరి)\s*(?:నుంచి|to|→)?\s*([A-Za-z\u0C00-\u0C7F]+)/i);
  if (village) return { to: village[1].trim() };

  return {};
}

function isRoundTrip(text: string, days?: number): boolean | undefined {
  if (/round\s*trip/i.test(text) || /return/i.test(text)) return true;
  if (/one\s*way/i.test(text) || /one-way/i.test(text)) return false;
  if (days && days >= 2) return true;
  return undefined;
}

export function parseTripIntent(text: string): ParsedTripIntent {
  const budget = extractBudget(text);
  const pax = extractPax(text);
  const days = extractDays(text);
  const veh = extractVehicle(text);
  const withDriver = extractDriver(text);
  const locs = extractLocations(text);
  const roundTrip = isRoundTrip(text, days);

  const hasTelugu = /[\u0C00-\u0C7F]/.test(text);
  const hasEnglish = /[a-zA-Z]/.test(text);
  const languageHint = hasTelugu && hasEnglish ? "mixed" : hasTelugu ? "te" : "en";

  return {
    budget,
    from: locs.from,
    to: locs.to,
    pax,
    days,
    vehicleCategory: veh.category,
    vehicleModel: veh.model,
    withDriver,
    roundTrip,
    languageHint,
  };
}

// For prompt: summarize what is still missing to ask exactly one question
export function missingFields(intent: ParsedTripIntent): string[] {
  const missing: string[] = [];
  if (!intent.from) missing.push("pickup location");
  if (!intent.to) missing.push("destination");
  if (!intent.pax) missing.push("number of passengers");
  // withDriver optional — only ask if vehicle category suggests need
  return missing;
}
