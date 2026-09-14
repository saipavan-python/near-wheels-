import { prisma } from "@/lib/db";

export const MAX_YATRA_STOPS = 20;

export type YatraStopInput = {
  name: string;
  city?: string;
  state?: string;
  description?: string;
  arrivalTime?: string;
  departureTime?: string;
};

export function parseDateOnly(value: unknown): Date | null {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function publicPackage(pkg: any) {
  return {
    id: pkg.id,
    packageName: pkg.packageName,
    description: pkg.description,
    category: pkg.category,
    pricePerHead: pkg.pricePerHead,
    totalSeats: pkg.totalSeats,
    bookedSeats: pkg.bookedSeats,
    availableSeats: Math.max(0, pkg.totalSeats - pkg.bookedSeats),
    departureDate: pkg.departureDate.toISOString().slice(0, 10),
    returnDate: pkg.returnDate?.toISOString().slice(0, 10) || null,
    durationDays: pkg.durationDays,
    status: pkg.status,
    operator: {
      id: pkg.operator.id,
      name: pkg.operator.businessName,
      rating: pkg.operator.ratingCount ? pkg.operator.ratingAvg : null,
      verified: pkg.operator.isVerified,
    },
    vehicle: {
      id: pkg.vehicle.id,
      title: pkg.vehicle.title,
      category: pkg.vehicle.category,
      seats: pkg.vehicle.seats,
      ac: pkg.vehicle.ac,
    },
    driver: pkg.driver
      ? { name: pkg.driver.provider.businessName, rating: pkg.driver.provider.ratingCount ? pkg.driver.provider.ratingAvg : null }
      : null,
    stops: pkg.stops.map((stop: any) => ({
      id: stop.id,
      order: stop.order,
      name: stop.name,
      city: stop.city,
      state: stop.state,
      description: stop.description,
      arrivalTime: stop.arrivalTime,
      departureTime: stop.departureTime,
    })),
  };
}

export const packageInclude = {
  operator: true,
  vehicle: true,
  driver: { include: { provider: true } },
  stops: { orderBy: { order: "asc" as const } },
};

export async function operatorForUser(userId: string) {
  return prisma.provider.findFirst({ where: { userId, type: "VEHICLE_OWNER" } });
}

export function validateStops(value: unknown): YatraStopInput[] {
  if (!Array.isArray(value) || value.length < 1) throw new Error("At least one temple destination is required");
  if (value.length > MAX_YATRA_STOPS) throw new Error("Maximum 20 temple destinations allowed");
  return value.map((stop, index) => {
    const input = (stop || {}) as Record<string, unknown>;
    const name = String(input.name || "").trim();
    if (!name) throw new Error(`Temple stop ${index + 1} requires a name`);
    return {
      name: name.slice(0, 160),
      city: input.city ? String(input.city).slice(0, 100) : undefined,
      state: input.state ? String(input.state).slice(0, 100) : undefined,
      description: input.description ? String(input.description).slice(0, 500) : undefined,
      arrivalTime: input.arrivalTime ? String(input.arrivalTime).slice(0, 20) : undefined,
      departureTime: input.departureTime ? String(input.departureTime).slice(0, 20) : undefined,
    };
  });
}