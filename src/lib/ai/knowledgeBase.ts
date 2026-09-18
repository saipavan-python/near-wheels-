/**
 * Deterministic knowledge-base "RAG" for the offline assistant.
 *
 * When Gemini is unavailable (no API key / quota exhausted) the bot falls back
 * to this retrieval engine: it matches the user's words against curated,
 * grounded Q&A entries (pricing, cancellation, insurance, how booking works,
 * each service) and returns a confident, typo-tolerant answer. Nothing here is
 * invented — every fact mirrors marketing/support copy and server config.
 */

export interface KnowledgeEntry {
  id: string;
  keywords: string[]; // phrases to look for; longer phrases weigh more
  answer: string;
  suggestions?: string[];
}

const KB: KnowledgeEntry[] = [
  {
    id: "capabilities",
    keywords: ["what can you do", "how do you work", "help", "what can you help", "assistant", "koosa", "enduku vachindi"],
    answer:
      "I can help you with the whole journey on Near Wheels: find and book vehicles (self-drive or with driver), hire a driver, find a nearby garage that is open right now, book farm equipment or drone spraying, budget-plan a trip (I work out vehicle + driver + fuel + toll + parking against your ₹ budget), check or cancel a booking, and answer questions about pricing and policies. Just tell me what you need in your own words and I'll check the live marketplace.",
    suggestions: ["Rent a car for a day", "Need a driver nearby", "Plan a trip under 8000", "Find an open garage"],
  },
  {
    id: "booking_steps",
    keywords: ["how to book", "book karale", "booking process", "book a vehicle", "how booking works", "reserve"],
    answer:
      "Booking is simple: tell me what you need (vehicle, driver, garage, farm or drone service) and where — I'll show live, bookable options from the marketplace. Tap a listing to see the price breakdown, pick your date and time, and confirm — during the free launch period the booking is confirmed right away with no advance or payment needed. You can track and manage the booking from My Bookings any time.",
    suggestions: ["Rent a car for a day", "Plan a trip under 8000"],
  },
  {
    id: "how_paid",
    keywords: ["payment", "pay", "pay cheyyali", "payments", "online", "advance", "money", "chrome", "upi", "card"],
    answer:
      "Right now Near Wheels is FREE to use during its launch period — when you book, the booking is confirmed automatically and no advance or payment is needed. You never pay cash blindly to anyone. Payments will be introduced later, and then every amount you see is the amount confirmed before you pay.",
    suggestions: ["Check my booking", "Cancel a booking"],
  },
  {
    id: "cancellation",
    keywords: ["cancel booking", "cancel cheyali", "cancellation", "cancel", "tirigi", "refund", "refundable", "money back"],
    answer:
      "You can cancel any time from My Bookings. Cancellation is free before the provider accepts your request, and free up to 2 hours before the trip start time. After that, a cancellation fee of 10% of the booking total would apply — but during the free launch period nothing is charged.",
    suggestions: ["Check my booking", "Book a cab for a day"],
  },
  {
    id: "deposit",
    keywords: ["deposit", "security deposit", "advance amount", "yokka", "hold"],
    answer:
      "During the free launch period no advance and no security deposit is charged — you just book and the booking is confirmed. When payments launch, any deposit will always be shown clearly on the listing before you pay, and it is released when the vehicle is returned safely.",
    suggestions: ["Rent a car for a day", "Check my booking"],
  },
  {
    id: "insurance",
    keywords: ["insurance", "bima", "insure", "accident", "damage", "cover"],
    answer:
      "Every booking includes basic insurance coverage — so you are not on your own if something goes wrong. Full coverage details are shared with you at confirmation. Minor wear and tear is normal; any damage beyond that is handled fairly between you and the provider, with basic insurance covering the standard cases.",
    suggestions: ["Rent a car for a day", "Book a driver for a day"],
  },
  {
    id: "pricing_vehicle",
    keywords: ["price", "rate", "rent", "cost", "entha", "haragu", "per km", "per km", "daily", "charge"],
    answer:
      "Vehicles are priced per day and/or per kilometre: the per-day rate covers the vehicle + driver (where included) and the per-km rate adds the distance actually travelled. On a trip I can also add fuel, toll and parking as estimates. Every listing shows its confirmed price before you book, and there are no hidden charges.",
    suggestions: ["Plan a trip under 8000", "Rent a car for a day"],
  },
  {
    id: "fuel_toll",
    keywords: ["fuel", "petrol", "diesel", "toll", "parking", "igu", "distance"],
    answer:
      "Fuel, toll and parking are estimated on top of the confirmed vehicle + driver rate — fuel is calculated from the exact route distance and mileage, and toll/parking are regional estimates. You'll always see them itemised in the price breakdown before you pay.",
    suggestions: ["Plan a trip under 8000"],
  },
  {
    id: "driver_help",
    keywords: ["driver", "drivr", "driving", "chauffeur", "drivver"],
    answer:
      "Drivers are verified, background-checked local professionals. You can hire a driver separately (usually by the day for your own or a rented vehicle) or together with a vehicle. Quotes are confirmed before booking, and the driver's rating and verification status are shown on the listing.",
    suggestions: ["Need a driver nearby", "Book a car with driver"],
  },
  {
    id: "garage_help",
    keywords: ["garage", "mechanic", "mech", "repair", "puncture", "towing", "tow", "jumpstart", "battery", "oil change", "service centre"],
    answer:
      "Garages around you show their real opening hours — I list which ones are open right now and which are 24×7. You can request mechanic, towing, battery jumpstart, tyre puncture and breakdown help, and garages that offer emergency response show a lightning badge. Book a visit and the garage confirms with its visit charge.",
    suggestions: ["Find an open garage", "My car broke down"],
  },
  {
    id: "garage_hours",
    keywords: ["opening", "open now", "open right now", "open", "closed", "hours", "timings", "24x7", "24/7", "enduku closed"],
    answer:
      "Garage availability comes straight from each garage's registered opening times — so if a garage says it is open 24×7 it lists as open always, and one with set hours automatically shows Open now or Closed now based on the current time. In an emergency I only show garages that are open right now.",
    suggestions: ["Find an open garage", "My car broke down"],
  },
  {
    id: "farm_help",
    keywords: ["farm", "tractor", "harvest", "plough", "crop", "acre", "punte", "peeling", "farming", "krushi"],
    answer:
      "Farm help covers tractors and equipment work priced per acre — ploughing, and the heavy jobs during sowing and harvest. Nearby verified farm service providers appear with per-acre pricing, and you can book equipment for a specific date and acreage.",
    suggestions: ["Need a tractor tomorrow"],
  },
  {
    id: "drone_help",
    keywords: ["drone", "spray", "spraying", "pesticide", "agri spray", "aerial"],
    answer:
      "Drone spraying is priced per acre and covers pesticide/liquid spraying over your field — faster and safer than manual spraying. Providers are verified operators with live pricing and availability for your chosen date.",
    suggestions: ["Need drone spraying for 3 acres"],
  },
  {
    id: "yatra_bus",
    keywords: ["yatra", "bus", "temple", "package", "pilgrimage", "tirumala", "sabarimala", "yatre"],
    answer:
      "Yatra bus packages are curated round-trips for temple/pilgrimage journeys — bus, stops, and seats shown per head with no advance needed and free cancellation before confirmation. I can find open Yatra packages for your route.",
    suggestions: ["Find Yatra packages"],
  },
  {
    id: "driving_school",
    keywords: ["driving school", "learn driving", "license", "learner", "learnt", "license test", "car driving class"],
    answer:
      "Driving schools in your area offer courses to learn driving and prepare for the licence test — with trained instructors and practice schedules. Just ask me for a driving school near your town.",
    suggestions: ["Find a driving school"],
  },
  {
    id: "share_ride",
    keywords: ["share ride", "sharing", "pool", "lift", "fellow", "sharing car", "share cheyali"],
    answer:
      "Share-rides let you post or find a trip you're already making and split the fuel/cost with people going the same way — like a friendly ride pool between towns. Listings show the route, date and seat price, and you can post your own too.",
    suggestions: ["Share my ride to Hyderabad"],
  },
  {
    id: "register_provider",
    keywords: ["become a provider", "register my", "list my vehicle", "sell my service", "provider account", "partner", "enroll", "join"],
    answer:
      "To offer services on Near Wheels, register from the Provider section — you can list vehicles, become a driver, open a garage with your opening hours & emergency availability, or provide farm/drone services. After a quick verification your listings go live for bookings.",
    suggestions: ["Register my garage"],
  },
  {
    id: "location_help",
    keywords: ["use my location", "my location", "near me", "ikkada", "daggara", "nearby", "close to me", "gps"],
    answer:
      "You can tap 'Use my location' to share your GPS and I'll search right around you — or just name a place, even with spelling loosely, like 'Guntor', 'Tirupathi' or 'Yerragunta bus stand' — I'll correct and find it.",
    suggestions: ["Use my location", "Find a garage"],
  },
  {
    id: "language",
    keywords: ["telugu", "hindi", "english lo", "telugulo", "hindilo", "matladalante"],
    answer:
      "You can talk to me in English, Telugu or Hindi (or a mix!) — for example 'naa daggarlo oka auto kavali' (I need an auto near me) or 'Guntur నుంచి Tirupati వెళ్లాలి'. I'll understand and answer in the same style.",
    suggestions: ["Find a vehicle near me", "Plan a trip under 8000"],
  },
  {
    id: "trip_budget",
    keywords: ["budget trip", "plan a trip", "trip plan", "bajget", "trip planning", "yatra plan", "itinerary"],
    answer:
      "Tell me your budget, pickup and destination (and how many people) and I'll compute a real plan: confirmed vehicle + driver rate plus estimated fuel, toll and parking, and tell you honestly whether it fits your budget. Example: '₹10,000 Guntur to Tirupati 5 members Ertiga + driver'.",
    suggestions: ["Plan a trip under 8000", "Budget trip plan"],
  },
];

function normLower(q: string): string {
  return q
    .toLowerCase()
    .replace(/[₹]\s*([\d,]+)/g, " $1 rupees ")
    .replace(/[.,!?;:/"'()\[\]{}+*_|\\^-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Facts injected verbatim into the LLM prompt so the AI never mis-states policy. */
export const KNOWLEDGE_FACTS = KB.map((e, i) => `${i + 1}. ${e.answer}`).join("\n\n");

/** Score the user's text against entry keywords; longer phr-ases weigh more. */
export function retrieveKnowledge(
  query: string
): { entry: KnowledgeEntry; score: number } | null {
  const q = normLower(query);
  if (!q) return null;
  let best: { entry: KnowledgeEntry; score: number } | null = null;
  for (const entry of KB) {
    let score = 0;
    for (const kw of entry.keywords) {
      const k = kw.toLowerCase();
      if (k.length >= 3 && q.includes(k)) score += k.length >= 10 ? 4 : k.length >= 6 ? 3 : k.length >= 4 ? 2 : 1;
    }
    if (best === null || score > best.score) {
      best = { entry, score };
    }
  }
  return best && best.score >= 3 ? best : null;
}

export function knowledgeAnswer(query: string): { entry: KnowledgeEntry; score: number } | null {
  return retrieveKnowledge(query);
}