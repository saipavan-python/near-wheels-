import { NextRequest } from "next/server";
import {
  searchVehicles,
  searchDrivers,
  searchGarages,
  searchFarm,
  searchDrones,
  AmbiguousLocationError,
  NoLocationError,
} from "@/lib/services/searchService";
import { ok, fail } from "@/lib/http";
import { track } from "@/lib/services/analyticsService";
import type { SearchFilters } from "@/lib/types";

export const runtime = "nodejs";

const TYPES = ["vehicles", "drivers", "garages", "farm", "drones"] as const;
type SearchType = (typeof TYPES)[number];

export async function GET(req: NextRequest) {
  const { checkRateLimit, getClientIp } = await import("@/lib/rateLimit");
  const ip = getClientIp(req);
  const rl = checkRateLimit(`search:${ip}`, 30, 60_000);
  if (!rl.allowed) return fail("Too many searches. Please wait a moment.", 429);
  const sp = req.nextUrl.searchParams;
  const type = (sp.get("type") || "vehicles") as SearchType;
  if (!TYPES.includes(type)) return fail("Unknown search type");

  const f: SearchFilters = {};
  if (sp.get("locationText")) f.locationText = sp.get("locationText")!;
  if (sp.get("lat")) f.lat = Number(sp.get("lat"));
  if (sp.get("lng")) f.lng = Number(sp.get("lng"));
  if (sp.get("radiusKm")) f.radiusKm = Number(sp.get("radiusKm"));
  if (sp.get("category")) f.category = sp.get("category")!;
  if (sp.get("model")) f.model = sp.get("model")!;
  const mode = sp.get("rentalMode");
  if (mode === "SELF_DRIVE" || mode === "WITH_DRIVER") f.rentalMode = mode;
  if (sp.get("seats")) f.seats = Number(sp.get("seats"));
  const ac = sp.get("ac");
  if (ac === "true") f.ac = true;
  else if (ac === "false") f.ac = false;
  else f.ac = null; // unspecified stays unknown
  if (sp.get("loadTons")) f.loadTons = Number(sp.get("loadTons"));
  if (sp.get("acres")) f.acres = Number(sp.get("acres"));
  if (sp.get("serviceTypes")) f.serviceTypes = sp.get("serviceTypes")!.split(",");
  if (sp.get("scheduledFor")) f.scheduledFor = sp.get("scheduledFor")!;
  if (sp.get("date")) f.date = sp.get("date")!;
  if (sp.get("startDate")) f.startDate = sp.get("startDate")!;
  if (sp.get("endDate")) f.endDate = sp.get("endDate")!;
  if (sp.get("durationDays")) f.durationDays = Number(sp.get("durationDays"));
  if (sp.get("durationHours")) f.durationHours = Number(sp.get("durationHours"));
  const sortRaw = sp.get("sortBy");
  if (sortRaw && ["BEST_MATCH", "NEAREST", "CHEAPEST", "BEST_RATED", "FASTEST"].includes(sortRaw))
    f.sortBy = sortRaw as SearchFilters["sortBy"];

  try {
    let result;
    switch (type) {
      case "drivers":
        result = await searchDrivers(f);
        break;
      case "garages":
        result = await searchGarages(f);
        break;
      case "farm":
        result = await searchFarm(f);
        break;
      case "drones":
        result = await searchDrones(f);
        break;
      default:
        result = await searchVehicles(f);
    }
    return ok({ result });
  } catch (e: any) {
    if (e instanceof AmbiguousLocationError) {
      return Response.json(
        { ok: false, error: "ambiguous_location", message: "I found multiple matching places. Which one do you mean?", options: e.candidates },
        { status: 300 }
      );
    }
    if (e instanceof NoLocationError) {
      return fail(e.message, 422, { code: "NO_LOCATION" });
    }
    console.error("search error");
    return fail("Search failed. Please try again.", 500);
  }
}

export async function POST(req: NextRequest) {
  // analytics endpoint for no-result / selection events from the UI
  const body = await req.json().catch(() => ({}));
  await track(String(body.kind || "ui_event").slice(0, 40), body.props || {});
  return ok({});
}
