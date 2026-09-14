// Centralized vehicle configuration — single source of truth for type-driven registration
// Controls: fields, features, validation, defaults, preview, API payload per vehicle category

export type VehicleCategory = "CAR" | "AUTO" | "BIKE" | "SCOOTER" | "SUV" | "VAN" | "PICKUP" | "TRUCK" | "BUS";

export interface VehicleField {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "number" | "select";
  options?: string[];
  min?: number;
  max?: number;
  required?: boolean;
}

export interface VehicleFeature {
  key: string;
  label: string;
}

export interface VehicleConfig {
  category: VehicleCategory;
  label: string;
  description: string;
  defaults: { seats: number; selfDrive: boolean; fuelType: string; transmission: string };
  fields: VehicleField[];
  features: VehicleFeature[];
  pricingModels: string[]; // subset of DAILY/HOURLY/PER_KM
  showAc?: boolean;
  showSelfDrive?: boolean;
}

export const VEHICLE_CONFIG: Record<VehicleCategory, VehicleConfig> = {
  CAR: {
    category: "CAR",
    label: "Car",
    description: "4-7 seater • AC option • Self-drive or with driver",
    defaults: { seats: 5, selfDrive: false, fuelType: "PETROL", transmission: "MANUAL" },
    fields: [
      { key: "make", label: "Brand", placeholder: "Maruti, Toyota, Hyundai", type: "text", required: true },
      { key: "model", label: "Model", placeholder: "Swift, Innova, Dzire", type: "text", required: true },
      { key: "year", label: "Year", placeholder: "2022", type: "number", min: 1990, max: 2026 },
      { key: "fuelType", label: "Fuel", placeholder: "Select fuel", type: "select", options: ["PETROL", "DIESEL", "CNG", "ELECTRIC"] },
      { key: "transmission", label: "Transmission", placeholder: "Select", type: "select", options: ["MANUAL", "AUTOMATIC"] },
      { key: "seats", label: "Seats", placeholder: "5", type: "number", min: 4, max: 7, required: true },
      { key: "color", label: "Color", placeholder: "White, Silver", type: "text" },
    ],
    features: [
      { key: "AC", label: "AC" },
      { key: "ABS", label: "ABS" },
      { key: "AIRBAGS", label: "Airbags" },
      { key: "POWER_STEERING", label: "Power Steering" },
      { key: "INFOTAINMENT", label: "Infotainment / Music" },
    ],
    pricingModels: ["DAILY", "HOURLY", "PER_KM", "MIXED"],
    showAc: true,
    showSelfDrive: true,
  },
  SUV: {
    category: "SUV",
    label: "SUV",
    description: "5-7 seater • Higher ground clearance • With driver preferred",
    defaults: { seats: 7, selfDrive: false, fuelType: "DIESEL", transmission: "MANUAL" },
    fields: [
      { key: "make", label: "Brand", placeholder: "Mahindra, Toyota, Kia", type: "text", required: true },
      { key: "model", label: "Model", placeholder: "Scorpio, Innova Crysta", type: "text", required: true },
      { key: "year", label: "Year", placeholder: "2022", type: "number", min: 1990, max: 2026 },
      { key: "fuelType", label: "Fuel", placeholder: "Select fuel", type: "select", options: ["PETROL", "DIESEL"] },
      { key: "transmission", label: "Transmission", placeholder: "Select", type: "select", options: ["MANUAL", "AUTOMATIC"] },
      { key: "seats", label: "Seats", placeholder: "7", type: "number", min: 5, max: 7, required: true },
      { key: "color", label: "Color", placeholder: "White, Black", type: "text" },
    ],
    features: [
      { key: "AC", label: "AC" },
      { key: "ABS", label: "ABS" },
      { key: "AIRBAGS", label: "Airbags" },
      { key: "4WD", label: "4WD" },
    ],
    pricingModels: ["DAILY", "HOURLY", "PER_KM", "MIXED"],
    showAc: true,
    showSelfDrive: true,
  },
  AUTO: {
    category: "AUTO",
    label: "Auto",
    description: "3 seater • CNG / Petrol • With driver only",
    defaults: { seats: 3, selfDrive: false, fuelType: "CNG", transmission: "MANUAL" },
    fields: [
      { key: "make", label: "Brand", placeholder: "Bajaj, TVS, Piaggio", type: "text", required: true },
      { key: "model", label: "Model", placeholder: "RE, Maxima, King", type: "text", required: true },
      { key: "year", label: "Year", placeholder: "2023", type: "number", min: 2000, max: 2026 },
      { key: "fuelType", label: "Fuel", placeholder: "Select fuel", type: "select", options: ["CNG", "PETROL", "DIESEL"] },
      { key: "color", label: "Color", placeholder: "Yellow, Black", type: "text" },
    ],
    features: [
      { key: "METERED", label: "Metered" },
      { key: "GPS", label: "GPS" },
    ],
    pricingModels: ["PER_KM", "DAILY", "HOURLY", "MIXED"],
    showAc: false,
    showSelfDrive: false,
  },
  BIKE: {
    category: "BIKE",
    label: "Bike",
    description: "2 seater • Self-drive only • Helmet included",
    defaults: { seats: 2, selfDrive: true, fuelType: "PETROL", transmission: "MANUAL" },
    fields: [
      { key: "make", label: "Brand", placeholder: "Honda, Bajaj, TVS", type: "text", required: true },
      { key: "model", label: "Model", placeholder: "Shine, Splendor, Pulsar", type: "text", required: true },
      { key: "year", label: "Year", placeholder: "2023", type: "number", min: 2000, max: 2026 },
      { key: "fuelType", label: "Fuel", placeholder: "Select", type: "select", options: ["PETROL", "ELECTRIC"] },
      { key: "engineCC", label: "Engine (cc)", placeholder: "125", type: "number", min: 50, max: 500 },
      { key: "mileage", label: "Mileage (kmpl)", placeholder: "55", type: "number", min: 20, max: 100 },
      { key: "color", label: "Color", placeholder: "Black, Red", type: "text" },
    ],
    features: [
      { key: "HELMET", label: "Helmet provided" },
      { key: "ABS", label: "ABS" },
    ],
    pricingModels: ["DAILY", "HOURLY", "PER_KM", "MIXED"],
    showAc: false,
    showSelfDrive: true,
  },
  SCOOTER: {
    category: "SCOOTER",
    label: "Scooter",
    description: "2 seater • Automatic • Self-drive",
    defaults: { seats: 2, selfDrive: true, fuelType: "PETROL", transmission: "AUTOMATIC" },
    fields: [
      { key: "make", label: "Brand", placeholder: "Honda, TVS, Suzuki", type: "text", required: true },
      { key: "model", label: "Model", placeholder: "Activa, Jupiter, Access", type: "text", required: true },
      { key: "year", label: "Year", placeholder: "2023", type: "number", min: 2000, max: 2026 },
      { key: "fuelType", label: "Fuel", placeholder: "Select", type: "select", options: ["PETROL", "ELECTRIC"] },
      { key: "engineCC", label: "Engine (cc)", placeholder: "110", type: "number", min: 50, max: 300 },
      { key: "mileage", label: "Mileage / Range", placeholder: "50 kmpl or 80 km", type: "text" },
      { key: "color", label: "Color", placeholder: "White, Grey", type: "text" },
    ],
    features: [
      { key: "HELMET", label: "Helmet provided" },
      { key: "USB_CHARGE", label: "USB Charging" },
    ],
    pricingModels: ["DAILY", "HOURLY", "PER_KM", "MIXED"],
    showAc: false,
    showSelfDrive: true,
  },
  VAN: {
    category: "VAN",
    label: "Van",
    description: "8-15 seater • With driver • Group travel",
    defaults: { seats: 12, selfDrive: false, fuelType: "DIESEL", transmission: "MANUAL" },
    fields: [
      { key: "make", label: "Brand", placeholder: "Force, Tata, Mahindra", type: "text", required: true },
      { key: "model", label: "Model", placeholder: "Traveller, Winger", type: "text", required: true },
      { key: "year", label: "Year", placeholder: "2021", type: "number", min: 1990, max: 2026 },
      { key: "fuelType", label: "Fuel", placeholder: "Select", type: "select", options: ["DIESEL", "PETROL", "CNG"] },
      { key: "seats", label: "Seats", placeholder: "12", type: "number", min: 8, max: 26, required: true },
      { key: "color", label: "Color", placeholder: "White", type: "text" },
    ],
    features: [
      { key: "AC", label: "AC" },
      { key: "PUSHBACK_SEATS", label: "Pushback Seats" },
    ],
    pricingModels: ["DAILY", "HOURLY", "PER_KM", "MIXED"],
    showAc: true,
    showSelfDrive: false,
  },
  PICKUP: {
    category: "PICKUP",
    label: "Pickup",
    description: "2 seater • Load carrier • With driver",
    defaults: { seats: 2, selfDrive: false, fuelType: "DIESEL", transmission: "MANUAL" },
    fields: [
      { key: "make", label: "Brand", placeholder: "Mahindra, Tata, Ashok Leyland", type: "text", required: true },
      { key: "model", label: "Model", placeholder: "Bolero Pikup, Yodha", type: "text", required: true },
      { key: "year", label: "Year", placeholder: "2020", type: "number", min: 1990, max: 2026 },
      { key: "loadCapacityTons", label: "Load Capacity (tons)", placeholder: "1.5", type: "number", min: 0.5, max: 5 },
      { key: "fuelType", label: "Fuel", placeholder: "Select", type: "select", options: ["DIESEL", "PETROL", "CNG"] },
      { key: "color", label: "Color", placeholder: "White", type: "text" },
    ],
    features: [
      { key: "OPEN_BODY", label: "Open Body" },
      { key: "CLOSED_BODY", label: "Closed Body" },
    ],
    pricingModels: ["DAILY", "HOURLY", "PER_KM", "PER_TRIP", "MIXED"],
    showAc: false,
    showSelfDrive: false,
  },
  TRUCK: {
    category: "TRUCK",
    label: "Truck",
    description: "Heavy load • With driver • Commercial",
    defaults: { seats: 2, selfDrive: false, fuelType: "DIESEL", transmission: "MANUAL" },
    fields: [
      { key: "make", label: "Brand", placeholder: "Tata, Ashok Leyland, Eicher", type: "text", required: true },
      { key: "model", label: "Model", placeholder: "LPK 1109, Eicher 1110", type: "text", required: true },
      { key: "year", label: "Year", placeholder: "2019", type: "number", min: 1990, max: 2026 },
      { key: "loadCapacityTons", label: "Load Capacity (tons)", placeholder: "9", type: "number", min: 1, max: 30 },
      { key: "fuelType", label: "Fuel", placeholder: "Select", type: "select", options: ["DIESEL"] },
      { key: "color", label: "Color", placeholder: "White", type: "text" },
    ],
    features: [
      { key: "6_WHEEL", label: "6 Wheel" },
      { key: "10_WHEEL", label: "10 Wheel" },
      { key: "CONTAINER", label: "Container Body" },
    ],
    pricingModels: ["DAILY", "HOURLY", "PER_KM", "PER_TRIP", "MIXED"],
    showAc: false,
    showSelfDrive: false,
  },
  BUS: {
    category: "BUS",
    label: "Bus",
    description: "20-60 seater • With driver • Group / Yatra",
    defaults: { seats: 32, selfDrive: false, fuelType: "DIESEL", transmission: "MANUAL" },
    fields: [
      { key: "make", label: "Brand", placeholder: "Eicher, Tata, Bharat Benz", type: "text", required: true },
      { key: "model", label: "Model", placeholder: "Starline 32, 407", type: "text", required: true },
      { key: "year", label: "Year", placeholder: "2018", type: "number", min: 1990, max: 2026 },
      { key: "seats", label: "Seats", placeholder: "32", type: "number", min: 12, max: 60, required: true },
      { key: "fuelType", label: "Fuel", placeholder: "Select", type: "select", options: ["DIESEL", "CNG"] },
      { key: "color", label: "Color", placeholder: "White", type: "text" },
    ],
    features: [
      { key: "AC", label: "AC" },
      { key: "PUSHBACK", label: "Pushback Seats" },
      { key: "WASHROOM", label: "Washroom" },
    ],
    pricingModels: ["DAILY", "HOURLY", "PER_KM", "MIXED"],
    showAc: true,
    showSelfDrive: false,
  },
};

export function getVehicleConfig(cat: string): VehicleConfig {
  const key = cat as VehicleCategory;
  return VEHICLE_CONFIG[key] || VEHICLE_CONFIG.CAR;
}

export const VEHICLE_CATEGORIES = Object.keys(VEHICLE_CONFIG) as VehicleCategory[];
