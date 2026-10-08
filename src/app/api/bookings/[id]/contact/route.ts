import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{  id: string  }> }) {
  const session = await getSession();
  if (!session) return fail("Login required", 401);

  const booking = await prisma.booking.findUnique({
    where: { id: (await ctx.params).id },
    include: {
      provider: { select: { businessName: true, phone: true, addressText: true } },
      customer: { select: { name: true, phone: true, email: true } },
      driver: { select: { name: true, phone: true, photoUrl: true, rating: true, verificationStatus: true, licenseStatus: true, experienceYears: true } },
      vehicle: { select: { title: true, make: true, model: true, category: true, registrationNumber: true, color: true, imageUrl: true, seats: true, fuelType: true, transmission: true } },
    },
  });
  if (!booking) return fail("Booking not found", 404);

  const isCustomer = booking.customerId === session.userId;
  const isProviderOwner = await (async () => {
    if (session.role === "PROVIDER") {
      const p = await prisma.provider.findFirst({ where: { userId: session.userId } });
      return !!p && p.id === booking.providerId;
    }
    return false;
  })();
  const isAdmin = session.role === "ADMIN";

  if (!isCustomer && !isProviderOwner && !isAdmin) return fail("Not your booking", 403);

  // Contact hidden before CONFIRMED (for non-admins)
  const allowedStatuses = ["CONFIRMED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED"];
  if (!allowedStatuses.includes(booking.status) && !isAdmin) {
    return ok({
      allowed: false,
      message: "Contact details will be available after admin confirms the booking.",
      status: booking.status,
    });
  }

  // Return minimal permitted contact + driver/vehicle details
  const driver = booking.driver
    ? {
        name: booking.driver.name,
        phone: booking.driver.phone,
        photoUrl: booking.driver.photoUrl,
        rating: booking.driver.rating,
        verified: (booking.driver.verificationStatus || "PENDING") === "VERIFIED",
        licenseVerified: (booking.driver.licenseStatus || "PENDING") === "APPROVED",
        experienceYears: booking.driver.experienceYears,
      }
    : null;

  const vehicle = booking.vehicle
    ? {
        title: booking.vehicle.title,
        make: booking.vehicle.make,
        model: booking.vehicle.model,
        category: booking.vehicle.category,
        registrationNumber: booking.vehicle.registrationNumber,
        color: booking.vehicle.color,
        imageUrl: booking.vehicle.imageUrl,
        seats: booking.vehicle.seats,
        fuelType: booking.vehicle.fuelType,
        transmission: booking.vehicle.transmission,
      }
    : null;

  if (isCustomer || isAdmin) {
    return ok({
      allowed: true,
      provider: {
        businessName: booking.provider.businessName,
        phone: booking.provider.phone,
        addressText: booking.provider.addressText,
      },
      driver,
      vehicle,
      bookingCode: booking.code,
      status: booking.status,
    });
  } else {
    return ok({
      allowed: true,
      customer: {
        name: booking.customer.name,
        phone: booking.customer.phone,
        email: booking.customer.email,
      },
      driver,
      vehicle,
      bookingCode: booking.code,
      status: booking.status,
    });
  }
}