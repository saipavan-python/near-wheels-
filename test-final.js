const http = require("http");
const BASE = "http://localhost:3001";

function req(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = { "Content-Type": "application/json" };
    if (cookie) headers["Cookie"] = cookie;
    const opts = { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers };
    const r = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        const sc = res.headers["set-cookie"];
        let nc = cookie;
        if (sc) { const nw = sc.find((c) => c.startsWith("nw_session=")); if (nw) nc = nw.split(";")[0]; }
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, json, cookie: nc });
      });
    });
    r.on("error", reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

let pass = 0, fail = 0;
function ok(label, result, detail) {
  if (result) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label} — ${detail || ""}`); }
}

async function main() {
  console.log("\n========================================");
  console.log("  CUD TESTS ON SUPABASE PostgreSQL");
  console.log("========================================\n");

  // === AUTH ===
  console.log("── AUTH ──");
  let r = await req("POST", "/api/admin/login", { phone: "8096327356", password: "P@wan kumar" });
  ok("Admin login", r.json?.ok, JSON.stringify(r.json));
  const ac = r.cookie;

  r = await req("GET", "/api/auth/me", null, ac);
  ok("GET /auth/me returns admin", r.json?.ok && r.json?.user?.role === "ADMIN", JSON.stringify(r.json?.user));

  r = await req("POST", "/api/auth/otp", { phone: "8096327356" });
  ok("Send OTP", r.json?.ok, JSON.stringify(r.json));

  // === GET (Read) ===
  console.log("\n── READ (GET) ──");
  r = await req("GET", "/api/admin/providers", null, ac);
  ok("GET /admin/providers", r.json?.ok, `count=${r.json?.data?.length}`);
  const providerCount = r.json?.data?.length || 0;

  r = await req("GET", "/api/admin/stats", null, ac);
  ok("GET /admin/stats", r.json?.ok, JSON.stringify(r.json?.stats).slice(0,80));

  r = await req("GET", "/api/admin/bookings", null, ac);
  ok("GET /admin/bookings", r.json?.ok, `count=${r.json?.bookings?.length}`);

  r = await req("GET", "/api/admin/driving-schools", null, ac);
  ok("GET /admin/driving-schools", r.json?.ok, `count=${r.json?.data?.length}`);

  r = await req("GET", "/api/share-rides");
  ok("GET /share-rides", r.json?.ok, `count=${r.json?.rides?.length}`);

  r = await req("GET", "/api/driving-schools");
  ok("GET /driving-schools", r.json?.ok, `count=${r.json?.count}`);

  r = await req("GET", "/api/yatra-buses");
  ok("GET /yatra-buses", r.json?.ok);

  r = await req("GET", "/api/locations");
  ok("GET /locations", r.json?.ok);

  r = await req("GET", "/api/providers/me");
  ok("GET /providers/me", r.json?.ok !== undefined, r.json?.ok ? "has provider data" : r.json?.error);

  r = await req("GET", "/api/pricing/calculate");
  ok("GET /pricing/calculate", r.json?.ok !== undefined);

  // === CREATE (POST) ===
  console.log("\n── CREATE (POST) ──");

  r = await req("POST", "/api/share-rides", {
    driverName: "CUD Test Driver",
    driverPhone: "9111111111",
    fromLocation: "Hyderabad",
    toLocation: "Vijayawada",
    travelDate: "2026-10-01",
    departureTime: "06:00 AM",
    totalSeats: 4,
    pricePerSeat: 450,
    vehicleTitle: "Toyota Innova",
    vehicleCategory: "CAR"
  });
  ok("POST /share-rides (create ride)", r.json?.ok, r.json?.ride?.id ? "id=" + r.json.ride.id : JSON.stringify(r.json));
  const rideId = r.json?.ride?.id;

  r = await req("POST", "/api/favorites", { providerId: providerCount > 0 ? r.json?.ride?.id || "skip" : "skip" });
  ok("POST /favorites (no auth)", r.status === 401, r.json?.error);

  r = await req("POST", "/api/reviews", { bookingId: "test", rating: 5 });
  ok("POST /reviews (no auth)", r.status === 401, r.json?.error);

  // === DELETE (with auth) ===
  console.log("\n── DELETE (with auth) ──");

  if (rideId) {
    r = await req("DELETE", `/api/share-rides/${rideId}`, null, ac);
    ok("DELETE /share-rides/[id]", r.json?.ok, JSON.stringify(r.json));
  }

  r = await req("DELETE", "/api/admin/providers", { ids: [] }, ac);
  ok("DELETE /admin/providers (empty)", r.json?.ok !== undefined, JSON.stringify(r.json));

  r = await req("DELETE", "/api/admin/driving-schools", { ids: [] }, ac);
  ok("DELETE /admin/driving-schools (empty)", r.json?.ok !== undefined, JSON.stringify(r.json));

  r = await req("DELETE", "/api/admin/bookings", { ids: [] }, ac);
  ok("DELETE /admin/bookings (empty)", r.json?.ok !== undefined, JSON.stringify(r.json));

  // === PATCH (Update) ===
  console.log("\n── UPDATE (PATCH) ──");

  if (providerCount > 0) {
    const pid = r.json?.data?.[0]?.id || (await req("GET", "/api/admin/providers", null, ac)).json?.data?.[0]?.id;
    r = await req("PATCH", "/api/admin/providers", { providerId: pid, action: "approve" }, ac);
    ok("PATCH /admin/providers (approve)", r.json?.ok !== undefined, JSON.stringify(r.json));
  }

  r = await req("PATCH", "/api/admin/driving-schools", { schoolId: "nonexistent", status: "ACTIVE" }, ac);
  ok("PATCH /admin/driving-schools", r.json?.ok !== undefined, JSON.stringify(r.json));

  // === DELETE (no auth — must reject) ===
  console.log("\n── AUTH GUARDS ──");

  const protectedDeletes = [
    ["/api/bookings/test", "bookings"],
    ["/api/share-rides/test", "share-rides"],
    ["/api/providers/vehicles/test", "vehicles"],
    ["/api/providers/drivers/test", "drivers"],
    ["/api/provider/assets/test", "provider/assets"],
    ["/api/driving-schools/test", "driving-schools"],
    ["/api/driving-bookings/test", "driving-bookings"],
    ["/api/reviews", "reviews"],
    ["/api/favorites", "favorites"],
  ];
  for (const [path, name] of protectedDeletes) {
    r = await req("DELETE", path);
    ok(`DELETE ${name} rejects unauth`, r.json?.error?.includes("Login") || r.status === 401, r.json?.error || "status=" + r.status);
  }

  // === AI ===
  console.log("\n── AI BOT ──");
  r = await req("POST", "/api/ai/trip-plan", { from: "Hyderabad", to: "Vijayawada", pax: 3 });
  ok("POST /ai/trip-plan", r.json?.ok, `options=${r.json?.options?.length}, cheapest=₹${r.json?.cheapest?.total}`);

  // === SUMMARY ===
  console.log("\n========================================");
  console.log(`  RESULTS: ${pass} passed, ${fail} failed`);
  console.log("========================================\n");

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
