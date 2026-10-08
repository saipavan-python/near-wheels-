// @ts-nocheck â€” SQLite mode insensitive + Json string casting handled at runtime
import { NextRequest } from "next/server";
import { ok, fail, readJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { createSessionToken, getSession } from "@/lib/session";
import { z } from "zod";

const registerSchema = z.object({
  schoolName: z.string().min(3),
  ownerName: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email().optional().or(z.literal("")),
  description: z.string().optional(),
  establishedYear: z.number().optional(),
  businessRegistration: z.string().optional(),
  address: z.string().optional().default(""),
  area: z.string().optional(),
  city: z.string().min(2),
  state: z.string().optional().default(""),
  pincode: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  services: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const data = await readJson(req);
    const body = registerSchema.parse(data);

    const phoneDigits = body.phone.replace(/\D/g, "");

    let session = await getSession();
    let userId = session?.userId;

    if (!userId) {
      let user = await prisma.user.findUnique({ where: { phone: phoneDigits } });
      if (!user) {
        user = await prisma.user.create({
          data: { phone: phoneDigits, name: body.ownerName, role: "PROVIDER" },
        });
      } else if (user.role === "CUSTOMER") {
        await prisma.user.update({ where: { id: user.id }, data: { role: "PROVIDER" } });
      }
      userId = user.id;
    }

    // Check if user already has a driving school
    const existing = await prisma.drivingSchool.findFirst({
      where: { ownerId: userId },
    });

    if (existing) {
      return fail("You already have a registered driving school", 400);
    }

    // Create the driving school
    const school = await prisma.drivingSchool.create({
      data: {
        ownerId: userId,
        schoolName: body.schoolName,
        ownerName: body.ownerName,
        phone: body.phone,
        email: body.email || undefined,
        description: body.description,
        establishedYear: body.establishedYear,
        businessRegistration: body.businessRegistration,
        address: body.address || "",
        area: body.area,
        city: body.city,
        state: body.state || "",
        pincode: body.pincode,
        lat: body.lat,
        lng: body.lng,
        servicesJson: JSON.stringify(body.services || []),
        status: "PENDING_VERIFICATION",
        isActive: true,
      },
    });

    const token = createSessionToken({ userId, role: "PROVIDER", name: body.ownerName });
    const res = ok({ school, schoolId: school.id });
    res.cookies.set("nw_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return res;
  } catch (error) {
    console.error("Error registering driving school:");
    if (error instanceof z.ZodError) {
      return fail("Validation error: " + error.errors.map((e) => e.message).join(", "), 400);
    }
    return fail("Error registering driving school", 500);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get("lat") || "0");
    const lng = parseFloat(searchParams.get("lng") || "0");
    const radiusKm = parseFloat(searchParams.get("radius") || "50");
    const city = searchParams.get("city");
    const courseType = searchParams.get("courseType");

    // Get nearby verified schools
    const schools = await prisma.drivingSchool.findMany({
      where: {
        status: "VERIFIED",
        isActive: true,
        ...(city ? { city: city } : {}),
      },
      include: {
        courses: {
          where: {
            isActive: true,
            ...(courseType ? { courseType: courseType } : {}),
          },
          select: { id: true, courseName: true, price: true, numLessons: true },
          take: 3,
        },
        reviews: {
          select: { rating: true },
        },
      },
      take: 50,
    });

    // Filter by distance if coordinates provided
    const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const nearby = schools.filter((s) => {
      const dist = haversine(lat, lng, s.lat, s.lng);
      return dist <= radiusKm;
    });

    const result = nearby
      .sort((a, b) => haversine(lat, lng, a.lat, a.lng) - haversine(lat, lng, b.lat, b.lng))
      .map((s) => {
        const avgRating = s.reviews.length > 0 ? s.reviews.reduce((sum, r) => sum + r.rating, 0) / s.reviews.length : 0;
        const priceFrom = s.courses.length > 0 ? Math.min(...s.courses.map((c) => c.price)) : 0;
        const distance = haversine(lat, lng, s.lat, s.lng);

        return {
          id: s.id,
          schoolName: s.schoolName,
          logoUrl: s.logoUrl,
          coverImageUrl: s.coverImageUrl,
          verified: s.status === "VERIFIED",
          rating: Math.round(avgRating * 10) / 10,
          ratingCount: s.reviews.length,
          distance: Math.round(distance * 10) / 10,
          location: s.address,
          city: s.city,
          services: JSON.parse(s.servicesJson || "[]"),
          courses: s.courses.map((c) => ({
            name: c.courseName,
            price: c.price,
            numLessons: c.numLessons,
          })),
          priceFrom,
          status: s.status,
        };
      });

    return ok({ schools: result, count: result.length });
  } catch (error) {
    console.error("Error fetching driving schools:");
    return fail("Error fetching driving schools", 500);
  }
}

export const dynamic = "force-dynamic";