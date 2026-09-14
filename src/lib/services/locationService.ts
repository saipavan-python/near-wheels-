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

  if (scored.length === 0) return empty;

  const top = scored[0];
  const ties = scored.filter((s) => s.score > 0.85 && Math.abs(s.score - top.score) < 0.06);

  if (top.score >= 0.9 && ties.length <= 1) {
    return { resolved: top.loc, candidates: scored.slice(0, 4).map((s) => s.loc), confidence: top.score, ambiguous: false };
  }

  // Ambiguous: multiple strong candidates (e.g., two different the villages)
  return { resolved: null, candidates: scored.slice(0, 4).map((s) => s.loc), confidence: top.score * 0.7, ambiguous: true };
}

export async function searchLocations(term: string, limit = 8) {
  const clean = stripLandmarkWords(term);
  const q = norm(clean || term);
  if (!q) return [];
  const all = await getLocations();
  return all
    .filter((l) => norm(l.name).includes(q) || JSON.parse(l.aliases || "[]").some((a: string) => norm(a).includes(q)))
    .sort((a, b) => (b.popular === a.popular ? a.name.localeCompare(b.name) : b.popular ? 1 : -1))
    .slice(0, limit);
}
