import { prisma } from "../db";
import type { Location } from "@prisma/client";

export interface ResolvedLocation {
  resolved: Location | null;
  candidates: Location[];
  confidence: number; // 0..1
  ambiguous: boolean;
}

// In-memory TTL cache: the full location table is small and changes rarely
// (admin-seeded). resolveLocation + searchLocations are hot paths on every
// search/keyword, so cache the result set briefly instead of a DB round-trip.
const LOCATION_CACHE_TTL_MS = 60_000;
const locationCache: { loadedAt: number; promise: Promise<Location[]> | null } = {
  loadedAt: 0,
  promise: null,
};

function getLocations(): Promise<Location[]> {
  const now = Date.now();
  if (locationCache.promise && now - locationCache.loadedAt < LOCATION_CACHE_TTL_MS) {
    return locationCache.promise;
  }
  const p = prisma.location.findMany();
  locationCache.promise = p;
  locationCache.loadedAt = now;
  return p;
}

export function clearLocationCache() {
  locationCache.promise = null;
  locationCache.loadedAt = 0;
}

// Village-friendly landmark phrases: "bus stand pakkana", "hospital opposite", "main road near temple"
// Also handles Telugu particles: pakkana=near, daggara=near, deggara=near, bayata=outside, lopala=inside, mundu=front, venaka=back
const LANDMARK_STOPWORDS = new Set([
  "near","nearby","around","at","in","the","my","me","close","to","village","ooru","oori","pakkana","pakkane","daggara","deggara","bayata","lopala","mundu","venaka","opposite","opp","beside","next","beyond","main","road","market","bus","stand","railway","station","temple","gudi","hospital","school","college","mandal","town","city","district","lo","ki","ke","ku","da","nundi","nunchi",
]);

const LANDMARK_HINTS: Record<string, string[]> = {
  "bus stand": ["bus","stand"],
  "railway station": ["railway","station"],
  "hospital": ["hospital","aspatari"],
  "temple": ["temple","gudi","aalayam"],
  "market": ["market","santhe","bazaar"],
  "main road": ["main","road","highway","nh"],
  "school": ["school","college"],
};

/** Levenshtein distance — used to tolerate spelling mistakes (Guntor → Guntur). */
export function levenshtein(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  let prev = new Array(m + 1).fill(0).map((_, i) => i);
  let curr = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[m];
}

/** How similar two normalized place-name tokens are (0..1). */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * One misspelled token — e.g. "Guntor" for Guntur, "Tirupathi" for Tirupati.
 * Requires same first letter, min length 4 and a threshold that keeps distant
 * villages apart. Returns null when nothing is close enough.
 */
function fuzzyMatchToken(query: string, candidates: Location[]): { loc: Location; score: number } | null {
  const q = norm(query);
  if (q.length < 4) return null;
  const parts = q.split(" ");
  const primary = parts[0];
  if (primary.length < 4) return null;
  let best: { loc: Location; score: number } | null = null;
  for (const loc of candidates) {
    const name = norm(loc.name);
    const names = [name, ...JSON.parse(loc.aliases || "[]").map((a: string) => norm(a))];
    for (const cand of names) {
      if (!cand || cand.length < 4 || cand[0] !== primary[0]) continue;
      const sim = similarity(primary, cand);
      const allowed = cand.length >= 8 ? 0.62 : 0.72;
      if (sim >= allowed) {
        const score = 0.55 + sim * 0.2;
        if (!best || score > best.score) best = { loc, score };
      }
    }
  }
  return best;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\u0C00-\u0C7Fa-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLandmarkWords(s: string): string {
  const parts = norm(s).split(/\s+/);
  const kept = parts.filter((p) => !LANDMARK_STOPWORDS.has(p));
  // keep at least 1 token even if all stopwords
  return kept.length ? kept.join(" ") : parts.join(" ");
}

function landmarkTokens(s: string): string[] {
  const n = norm(s);
  const hints: string[] = [];
  for (const [label, tokens] of Object.entries(LANDMARK_HINTS)) {
    if (tokens.some((t) => n.includes(t))) hints.push(label);
  }
  return hints;
}

/**
 * Resolve free-text place names, villages, landmarks (spec §11–12).
 * Never silently picks between genuinely different places with the same name.
 */
export async function resolveLocation(query: string | undefined | null): Promise<ResolvedLocation> {
  const empty: ResolvedLocation = { resolved: null, candidates: [], confidence: 0, ambiguous: false };
  if (!query || !query.trim()) return empty;

  const rawQ = query.trim();
  const cleanQ = stripLandmarkWords(rawQ);
  const q = cleanQ ? norm(cleanQ) : norm(rawQ);
  if (!q) return empty;

  const locations = await getLocations();

  // strip trailing landmark words e.g. "temple" -> base + landmark
  const parts = q.split(" ");
  const rawHints = landmarkTokens(rawQ);

  const scoreOf = (loc: Location): number => {
    const name = norm(loc.name);
    const aliases: string[] = JSON.parse(loc.aliases || "[]").map((a: string) => norm(a));
    let best = 0;
    const test = (cand: string) => {
      if (!cand) return;
      if (cand === name || aliases.includes(cand)) best = Math.max(best, 1);
      else if (name.startsWith(cand) && cand.length >= 4) best = Math.max(best, 0.9);
      else if (name.includes(cand) && cand.length >= 4) best = Math.max(best, 0.8);
    };
    test(q);
    // also test stripped phrase without landmark words
    if (cleanQ && cleanQ !== q) test(norm(cleanQ));
    // progressive n-grams so "temple" matches the village + TEMPLE type
    for (let take = parts.length; take >= 1; take--) {
      test(parts.slice(0, take).join(" "));
    }
    for (const p of parts) {
      if (p.length >= 3) test(p);
      if ((loc.type === "TEMPLE" && p.includes("temple")) ||
          (loc.type === "FOREST" && p.includes("forest")) ||
          (loc.type === "STATION" && p.includes("station")) ||
          (loc.type === "HIGHWAY" && p.includes("highway"))) {
        best = Math.max(best, Math.min(0.95, best + 0.15));
      }
    }
    // small boost if query contained landmark hint matching this location type
    if (rawHints.length) {
      const typeHints: Record<string, string[]> = {
        TEMPLE: ["temple"],
        STATION: ["railway station"],
        HIGHWAY: ["main road"],
        HOSPITAL: ["hospital"],
      };
      const needed = typeHints[loc.type] || [];
      if (needed.some((h) => rawHints.includes(h))) best = Math.min(1, best + 0.06);
    }
    if (loc.popular) best += 0.02;
    return Math.min(1, best);
  };

  const scored = locations
    .map((l) => ({ loc: l, score: scoreOf(l) }))
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    // Spelling-tolerance pass: "Guntor", "Tirupathi" etc. → closest real place.
    const fuzzy = fuzzyMatchToken(q, locations);
    if (fuzzy) {
      return {
        resolved: fuzzy.loc,
        candidates: [fuzzy.loc],
        confidence: Math.min(0.85, fuzzy.score),
        ambiguous: false,
      };
    }
    return empty;
  }

  const top = dedupeScoredLocations(scored)[0];
  const uniq = dedupeScoredLocations(scored);
  const ties = uniq.filter((s) => s.score > 0.85 && Math.abs(s.score - top.score) < 0.06);

  if (top.score >= 0.9 && ties.length <= 1) {
    return { resolved: top.loc, candidates: uniq.slice(0, 4).map((s) => s.loc), confidence: top.score, ambiguous: false };
  }

  // Ambiguous: multiple strong candidates (e.g., two different the villages)
  return { resolved: null, candidates: uniq.slice(0, 4).map((s) => s.loc), confidence: top.score * 0.7, ambiguous: true };
}

export interface ScoredLocation {
  loc: Location;
  score: number;
}

/**
 * Collapse duplicate gazetteer rows (same name at essentially the same point)
 * before deciding whether a query is ambiguous. Without this, a city listed
 * twice in the dataset ties with itself for the top score and the lookup is
 * wrongly reported as ambiguous.
 */
export function dedupeScoredLocations(scored: ScoredLocation[]): ScoredLocation[] {
  const seen = new Map<string, ScoredLocation>();
  for (const s of scored) {
    const key = `${norm(s.loc.name)}|${s.loc.lat.toFixed(4)},${s.loc.lng.toFixed(4)}`;
    const prev = seen.get(key);
    if (!prev || s.score > prev.score) seen.set(key, s);
  }
  return [...seen.values()].sort((a, b) => b.score - a.score);
}

export async function searchLocations(term: string, limit = 8) {
  const clean = stripLandmarkWords(term);
  const q = norm(clean || term);
  if (!q) return [];
  const all = await getLocations();
  const hits = dedupeScoredLocations(
    all
      .filter((l) => norm(l.name).includes(q) || JSON.parse(l.aliases || "[]").some((a: string) => norm(a).includes(q)))
      .sort((a, b) => (b.popular === a.popular ? a.name.localeCompare(b.name) : b.popular ? 1 : -1))
      .map((l) => ({ loc: l, score: l.popular ? 1 : 0.9 }))
  )
    .map((s) => s.loc)
    .slice(0, limit);
  if (hits.length) return hits;
  // spelling-tolerance fallback for the picker
  const fuzzy = fuzzyMatchToken(q, all);
  return fuzzy ? [fuzzy.loc] : [];
}
