import type { ToolDeclaration } from "./gemini";

/**
 * Tool declarations exposed to the model. These are the ONLY way the bot can
 * touch platform data (spec §50–51): every answer about vehicles, prices,
 * availability, bookings must come from one of these.
 */
export const TOOLS: ToolDeclaration[] = [
  {
    name: "resolve_location",
    description: "Resolve a place name/landmark to coordinates. Use when the customer mentions a place without giving GPS.",
    parameters: {
      type: "OBJECT",
      properties: { query: { type: "STRING", description: "place or landmark text, e.g. 'town temple'" } },
      required: ["query"],
    },
  },
  {
    name: "search_vehicles",
    description: "Search available vehicles (cars, autos, bikes, scooters, SUVs, vans, pickups, trucks, buses). Returns ranked result cards with real backend prices and distances. Never invent results yourself.",
    parameters: {
      type: "OBJECT",
      properties: {
        location_text: { type: "STRING", description: "area/place name; omit if lat/lng provided" },
        category: { type: "STRING", description: "CAR AUTO BIKE SCOOTER SUV VAN PICKUP TRUCK BUS TRACTOR" },
        model: { type: "STRING", description: "exact model if asked e.g. Innova" },
        rental_mode: { type: "STRING", description: "SELF_DRIVE or WITH_DRIVER" },
        seats: { type: "NUMBER" },
        ac: { type: "BOOLEAN", description: "only set when the customer explicitly asked AC/non-AC" },
        load_tons: { type: "NUMBER", description: "for trucks/pickups when they mention tons" },
        scheduled_for_iso: { type: "STRING", description: "ISO datetime for later booking; omit for now" },
        duration_days: { type: "NUMBER" },
        sort_by: { type: "STRING", description: "BEST_MATCH NEAREST CHEAPEST BEST_RATED FASTEST" },
      },
    },
  },
  {
    name: "search_drivers",
    description: "Search nearby available drivers (for the customer's own vehicle or a hired one).",
    parameters: {
      type: "OBJECT",
      properties: {
        location_text: { type: "STRING" },
        drive_category: { type: "STRING", description: "vehicle category they need driven, optional" },
        scheduled_for_iso: { type: "STRING" },
        sort_by: { type: "STRING" },
      },
    },
  },
  {
    name: "search_garages",
    description: "Search garages/mechanics including roadside help: towing, battery, tyre, breakdown, electrical, AC repair.",
    parameters: {
      type: "OBJECT",
      properties: {
        location_text: { type: "STRING" },
        service_types: { type: "ARRAY", items: { type: "STRING" }, description: "subset of MECHANIC TOWING BATTERY TYRE ELECTRICAL AC_REPAIR BREAKDOWN" },
      },
    },
  },
  {
    name: "search_farm_equipment",
    description: "Search farm equipment services: tractors, cultivators, rotavators, harvesters, water tankers etc.",
    parameters: {
      type: "OBJECT",
      properties: {
        location_text: { type: "STRING" },
        equipment_type: { type: "STRING", description: "TRACTOR TRACTOR_TRAILER CULTIVATOR ROTAVATOR HARVESTER WATER_TANKER FARM_TRANSPORT AGRI_MACHINE" },
        acres: { type: "NUMBER" },
      },
    },
  },
  {
    name: "search_drone_operators",
    description: "Search verified drone spraying service operators for farmland.",
    parameters: {
      type: "OBJECT",
      properties: { location_text: { type: "STRING" }, acres: { type: "NUMBER" } },
    },
  },
  {
    name: "get_result_details",
    description: "Get full details of one of the CURRENT search results by its position (1-based). Use for 'the second one', 'that car', 'show more'.",
    parameters: { type: "OBJECT", properties: { index: { type: "NUMBER" } }, required: ["index"] },
  },
  {
    name: "compare_results",
    description: "Compare two or more current results in a table. Use for 'compare the first two'.",
    parameters: { type: "OBJECT", properties: { indexes: { type: "ARRAY", items: { type: "NUMBER" } } }, required: ["indexes"] },
  },
  {
    name: "re_rank_results",
    description: "Re-rank the CURRENT results by a new priority like cheapest/nearest/best rated, or apply refined filters. Use for 'cheapest', 'show AC ones', '7 seater', 'actually tomorrow'.",
    parameters: {
      type: "OBJECT",
      properties: {
        sort_by: { type: "STRING" },
        ac: { type: "BOOLEAN" },
        seats: { type: "NUMBER" },
        category: { type: "STRING" },
        model: { type: "STRING" },
        rental_mode: { type: "STRING" },
        scheduled_for_iso: { type: "STRING" },
        duration_days: { type: "NUMBER" },
      },
    },
  },
  {
    name: "quote_price",
    description: "Get an itemized price quote from the pricing engine for one of the CURRENT results given days/hours/km/acres. Prices ONLY come from here — never make up numbers.",
    parameters: {
      type: "OBJECT",
      properties: {
        index: { type: "NUMBER" },
        days: { type: "NUMBER" },
        hours: { type: "NUMBER" },
        km: { type: "NUMBER" },
        acres: { type: "NUMBER" },
      },
      required: ["index"],
    },
  },
  {
    name: "create_booking",
    description: "Create a booking for one of the CURRENT results after the customer clearly confirms. The backend computes price and availability; response tells the true state (PENDING_PROVIDER / ACCEPTED / CONFIRMED).",
    parameters: {
      type: "OBJECT",
      properties: {
        index: { type: "NUMBER", description: "position of the result to book (1-based)" },
        scheduled_for_iso: { type: "STRING", description: "omit entirely for immediate booking" },
        duration_days: { type: "NUMBER" },
        duration_hours: { type: "NUMBER" },
        acres: { type: "NUMBER" },
        est_km: { type: "NUMBER" },
        note: { type: "STRING" },
      },
      required: ["index"],
    },
  },
  {
    name: "get_booking_status",
    description: "Fetch live status of a booking by code (or the latest one). Use for 'is my booking confirmed?', 'where is my driver?'.",
    parameters: { type: "OBJECT", properties: { code: { type: "STRING" } } },
  },
  {
    name: "cancel_booking",
    description: "Cancel a booking by code (or the latest) after customer confirms.",
    parameters: { type: "OBJECT", properties: { code: { type: "STRING" }, reason: { type: "STRING" } } },
  },
  {
    name: "modify_booking",
    description: "Change date/time/duration of a booking.",
    parameters: {
      type: "OBJECT",
      properties: {
        code: { type: "STRING" },
        scheduled_for_iso: { type: "STRING" },
        duration_days: { type: "NUMBER" },
        duration_hours: { type: "NUMBER" },
      },
    },
  },
  {
    name: "book_again",
    description: "Find a provider from this customer's history/favorites (e.g. 'book my previous driver', 'book my favorite garage') and check their current availability.",
    parameters: { type: "OBJECT", properties: { provider_name: { type: "STRING" }, favorite: { type: "BOOLEAN" } } },
  },
  {
    name: "plan_trip_with_budget",
    description:
      "Deterministic budget trip planner — checks if customer's budget covers vehicle+driver+fuel+toll+parking for a specific route. Use when customer mentions budget (₹, rupees, budget) with from/to. Backend computes real vehicle inventory, real routing distance, fuel (mileage*price), toll, parking and compares budget vs total. NEVER invent prices — this tool does all math.",
    parameters: {
      type: "OBJECT",
      properties: {
        budget: { type: "NUMBER", description: "customer budget in INR, e.g. 10000" },
        from: { type: "STRING", description: "pickup place/village/town, e.g. Guntur" },
        to: { type: "STRING", description: "destination place, e.g. Tirupati" },
        pax: { type: "NUMBER", description: "passengers count" },
        days: { type: "NUMBER", description: "trip duration days" },
        vehicle_category: { type: "STRING", description: "CAR SUV VAN AUTO etc if mentioned" },
        vehicle_model: { type: "STRING", description: "exact model like Ertiga, Innova if mentioned" },
        with_driver: { type: "BOOLEAN", description: "true if driver needed" },
        round_trip: { type: "BOOLEAN", description: "true if round trip / 2+ days" },
      },
      required: ["budget", "from", "to"],
    },
  },
  {
    name: "calculate_trip_cost",
    description:
      "Calculate detailed trip cost for a selected vehicle option (vehicle+driver+fuel+toll+parking). Use after search results to give itemized estimate before booking. Backend computes everything.",
    parameters: {
      type: "OBJECT",
      properties: {
        vehicle_index: { type: "NUMBER", description: "1-based index of vehicle in current results" },
        from: { type: "STRING" },
        to: { type: "STRING" },
        days: { type: "NUMBER" },
        with_driver: { type: "BOOLEAN" },
        round_trip: { type: "BOOLEAN" },
      },
      required: ["vehicle_index"],
    },
  },
  {
    name: "escalate_support",
    description: "Log a support issue the bot cannot resolve (payments, disputes, safety).",
    parameters: { type: "OBJECT", properties: { issue: { type: "STRING" } }, required: ["issue"] },
  },
];
