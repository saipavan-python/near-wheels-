import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  const count = await prisma.sharedRide.count();
  if (count > 0) {
    return ok({ message: "Seed already exists", count });
  }

  const sampleRides = [
    {
      driverName: "Rahul Kumar",
      driverPhone: "9876543210",
      driverRating: 4.9,
      driverTotalRides: 127,
      verified: true,
      fromLocation: "Guntur",
      toLocation: "Bangalore",
      travelDate: "2026-08-30",
      departureTime: "06:30 PM",
      vehicleTitle: "Maruti Suzuki Ertiga",
      vehicleCategory: "CAR",
      totalSeats: 4,
      availableSeats: 2,
      pricePerSeat: 500,
      stopsJson: JSON.stringify(["Vijayawada", "Nellore", "Chennai"]),
      preferencesJson: JSON.stringify({
        smoking: false,
        pets: true,
        luggage: "Medium",
        music: true,
        conversation: "Friendly",
        womenOnly: false,
      }),
      status: "ACTIVE",
    },
    {
      driverName: "Priya Sharma",
      driverPhone: "9812345678",
      driverRating: 4.8,
      driverTotalRides: 86,
      verified: true,
      fromLocation: "Guntur",
      toLocation: "Bangalore",
      travelDate: "2026-08-30",
      departureTime: "07:15 PM",
      vehicleTitle: "Kia Carens",
      vehicleCategory: "SUV",
      totalSeats: 6,
      availableSeats: 3,
      pricePerSeat: 550,
      stopsJson: JSON.stringify(["Vijayawada", "Tirupati"]),
      preferencesJson: JSON.stringify({
        smoking: false,
        pets: false,
        luggage: "Large",
        music: true,
        conversation: "Quiet",
        womenOnly: true,
      }),
      status: "ACTIVE",
    },
    {
      driverName: "Venkatesh Rao",
      driverPhone: "9988776655",
      driverRating: 5.0,
      driverTotalRides: 210,
      verified: true,
      fromLocation: "Hyderabad",
      toLocation: "Tirupati",
      travelDate: "2026-08-31",
      departureTime: "09:00 PM",
      vehicleTitle: "Toyota Innova Crysta",
      vehicleCategory: "SUV",
      totalSeats: 7,
      availableSeats: 4,
      pricePerSeat: 850,
      stopsJson: JSON.stringify(["Kurnool", "Nandyal", "Kadapa"]),
      preferencesJson: JSON.stringify({
        smoking: false,
        pets: false,
        luggage: "Large",
        music: true,
        conversation: "Friendly",
        womenOnly: false,
      }),
      status: "ACTIVE",
    },
  ];

  for (const r of sampleRides) {
    await prisma.sharedRide.create({ data: r });
  }

  return ok({ message: "Seeded 3 sample rides successfully!" });
}
