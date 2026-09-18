// Shared unions + result card contract used by services, AI tools and UI.

export type ProviderType =
  | "VEHICLE_OWNER"
  | "DRIVER"
  | "GARAGE"
  | "FARM"
  | "DRONE";

export const PROVIDER_STATUSES = [
  "DRAFT",
  "PENDING_VERIFICATION",
  "VERIFIED",
  "ACTIVE",
  "BUSY",
  "SUSPENDED",
  "REJECTED",
  "EXPIRED",
  "MAINTENANCE",
  "OFFLINE",
] as const;

export const AVAILABILITY_STATUSES = [
  "AVAILABLE_NOW",
  "BUSY",
  "SCHEDULED",
  "OFFLINE",
  "MAINTENANCE",
] as const;

export const VEHICLE_CATEGORIES = [
  "CAR",
  "AUTO",
  "BIKE",
  "SCOOTER",
  "SUV",
  "VAN",
  "PICKUP",
  "TRUCK",
  "BUS",
  "TRACTOR",
  "OTHER",
] as const;

export const GARAGE_SERVICES = [
  "MECHANIC",
  "TOWING",
  "BATTERY",
  "TYRE",
  "ELECTRICAL",
  "AC_REPAIR",
  "WATER_SERVICE",
  "BREAKDOWN",
] as const;

export const EQUIPMENT_TYPES = [
  "TRACTOR",
  "TRACTOR_TRAILER",
  "CULTIVATOR",
  "ROTAVATOR",
  "HARVESTER",
  "WATER_TANKER",
  "FARM_TRANSPORT",
  "AGRI_MACHINE",
] as const;

export const BOOKING_KINDS = [
  "VEHICLE_SELF_DRIVE",
  "VEHICLE_WITH_DRIVER",
  "DRIVER",
  "GARAGE",
  "MECHANIC_VISIT",
  "TOWING",
  "BATTERY",
  "TYRE",
  "FARM_EQUIPMENT",
  "DRONE_SPRAYING",
  "EMERGENCY",
] as const;

export const BOOKING_STATUSES = [
  "REQUESTED",
  "PENDING_PROVIDER",
  "ACCEPTED",
  "REJECTED",
  "CONFIRMED",
  "EN_ROUTE",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
  "DISPUTED",
] as const;

/** Standard search/sort preferences a customer can state naturally. */
export type SortPriority = "BEST_MATCH" | "NEAREST" | "CHEAPEST" | "BEST_RATED" | "FASTEST";

export interface SearchFilters {
  locationText?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  category?: string; // vehicle category / equipment type / garage service
  model?: string; // exact model e.g. Innova
  rentalMode?: "SELF_DRIVE" | "WITH_DRIVER";
  seats?: number;
  ac?: boolean | null; // null = unspecified (never coerce unknown→false)
  loadTons?: number;
  acres?: number;
  serviceTypes?: string[];
  scheduledFor?: string; // ISO
  startDate?: string; // ISO date for range
  endDate?: string; // ISO date for range
  date?: string; // alias for scheduledFor (YYYY-MM-DD)
  durationDays?: number;
  durationHours?: number;
  sortBy?: SortPriority;
}

/** The universal card every surface (web UI + AI bot) renders. */
export interface ResultCard {
  kind: "VEHICLE" | "DRIVER" | "GARAGE" | "FARM" | "DRONE" | "BUS" | "DRIVING_SCHOOL" | "SHARE_RIDE";
  id: string;
  providerId: string;
  title: string;
  subtitle: string;
  category: string;
  distanceKm: number | null;
  etaMin: number | null;
  availableNow: boolean;
  priceLabel: string;
  priceFrom: number | null;
  rating: number;
  verified: boolean;
  badges: { label: string; icon: string }[];
  reason?: string;
  emoji: string;
  meta: Record<string, string | number | boolean | null>;
  quoteParamsHint?: Record<string, unknown>;
  imageUrl?: string | null;
}

export interface SearchResult {
  querySummary: string;
  exactMatchFound: boolean;
  showingAlternatives: boolean;
  searchedRadiusKm: number;
  items: ResultCard[];
}

export interface PriceLine {
  label: string;
  amount: number;
  note?: string;
}

export interface PriceQuote {
  currency: string;
  lines: PriceLine[];
  total: number;
  confidence: "FINAL" | "ESTIMATE";
  disclaimer?: string;
}

// ── Driving School Types ────────────────────────────────────────────────

export const DRIVING_SCHOOL_SERVICES = [
  "BEGINNER_DRIVING",
  "MANUAL_DRIVING",
  "AUTOMATIC_DRIVING",
  "REFRESHER_DRIVING",
  "HIGHWAY_TRAINING",
  "PARKING_PRACTICE",
  "DEFENSIVE_DRIVING",
  "LICENSE_PREPARATION",
  "OTHER",
] as const;

export const DRIVING_SCHOOL_STATUSES = [
  "PENDING_VERIFICATION",
  "VERIFIED",
  "REJECTED",
  "SUSPENDED",
] as const;

export const DRIVING_COURSE_TYPES = [
  "BEGINNER_DRIVING",
  "MANUAL_DRIVING",
  "AUTOMATIC_DRIVING",
  "REFRESHER_DRIVING",
  "HIGHWAY_TRAINING",
  "PARKING_PRACTICE",
  "DEFENSIVE_DRIVING",
  "LICENSE_PREPARATION",
  "OTHER",
] as const;

export const INSTRUCTOR_VERIFICATION_STATUSES = [
  "PENDING",
  "VERIFIED",
  "REJECTED",
] as const;

export const DRIVING_BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
] as const;

export const DRIVING_LESSON_STATUSES = [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULED",
] as const;

export const DOCUMENT_TYPES = [
  "BUSINESS_LICENSE",
  "OWNER_ID",
  "VEHICLE_REGISTRATION",
  "OTHER",
] as const;

export const DRIVING_SKILLS = [
  "Vehicle Control",
  "Steering",
  "Braking",
  "Gear Control",
  "Parking",
  "Traffic Driving",
  "Highway Driving",
  "Speed Management",
  "Road Awareness",
  "Emergency Handling",
] as const;

export interface DrivingSchoolCard {
  id: string;
  schoolName: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  verified: boolean;
  rating: number;
  ratingCount: number;
  distance: number | null;
  location: string;
  city: string;
  services: string[];
  courses: { name: string; price: number; numLessons: number }[];
  priceFrom: number;
  status: string;
}

export interface DrivingSchoolDetails extends DrivingSchoolCard {
  ownerName: string;
  phone: string;
  email: string | null;
  description: string | null;
  address: string;
  area: string | null;
  state: string;
  pincode: string | null;
  lat: number;
  lng: number;
  establishedYear: number | null;
  workingHours: Record<string, { start: string; end: string }>;
  instructors: Array<{
    id: string;
    name: string;
    experience: number;
    rating: number;
    specialization: string[];
  }>;
  vehicles: Array<{
    id: string;
    brand: string;
    model: string;
    vehicleType: string;
    transmission: string;
    year: number;
  }>;
  galleries: Array<{ id: string; imageUrl: string; caption: string | null }>;
  completedLessons: number;
  totalStudents: number;
}
