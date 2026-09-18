import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail } from "@/lib/http";
import { getSession } from "@/lib/session";
import { searchLocations, clearLocationCache } from "@/lib/services/locationService";

export const runtime = "nodejs";

/** Gazetteer is stable -> long-lived CDN cache. */
const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=3600";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  const results = await searchLocations(q);
  return ok(
    {
      locations: results.map((l) => ({
        id: l.id,
        name: l.name,
        label: [l.name, l.type !== "CITY" ? l.type : null, l.district].filter(Boolean).join(", "),
        lat: l.lat,
        lng: l.lng,
        type: l.type,
      })),
    },
    { headers: { "Cache-Control": CACHE_CONTROL } }
  );
}

/** Admin gazetteer additions (kept minimal). */
export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session || session.role !== "ADMIN") return fail("Admin login required", 403);
  const b = await req.json().catch(() => ({}));
  if (!b.name || typeof b.lat !== "number" || typeof b.lng !== "number")
    return fail("name, lat, lng required");
  const loc = await prisma.location.create({
    data: {
      name: String(b.name).slice(0, 80),
      type: String(b.type || "VILLAGE"),
      district: b.district ? String(b.district) : null,
      state: b.state ? String(b.state) : null,
      lat: Number(b.lat),
      lng: Number(b.lng),
      aliases: JSON.stringify(Array.isArray(b.aliases) ? b.aliases.slice(0, 10) : []),
      popular: false,
    },
  });
  clearLocationCache();
  return ok({ location: loc });
}

export const dynamic = "force-dynamic";