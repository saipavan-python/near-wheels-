import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/services/auditService";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const school = await prisma.drivingSchool.findUnique({
      where: { id },
      include: {
        courses: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
        },
        vehicles: {
          where: { status: "ACTIVE" },
        },
        instructors: {
          where: { isActive: true },
        },
        galleries: {
          orderBy: { createdAt: "desc" },
        },
        reviews: {
          include: {
            student: {
              select: { name: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!school) {
      return fail("School not found", 404);
    }

    const avgRating =
      school.reviews.length > 0 ? Math.round((school.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / school.reviews.length) * 10) / 10 : 0;

    const response = {
      id: school.id,
      schoolName: school.schoolName,
      logoUrl: school.logoUrl,
      coverImageUrl: school.coverImageUrl,
      verified: school.status === "VERIFIED",
      rating: avgRating,
      ratingCount: school.reviews.length,
      ownerName: school.ownerName,
      phone: school.phone,
      email: school.email,
      description: school.description,
      address: school.address,
      area: school.area,
      city: school.city,
      state: school.state,
      pincode: school.pincode,
      lat: school.lat,
      lng: school.lng,
      establishedYear: school.establishedYear,
      services: JSON.parse(school.servicesJson || "[]"),
      completedLessons: school.completedLessons,
      totalStudents: school.totalStudents,
      courses: school.courses.map((c: any) => ({
        id: c.id,
        name: c.courseName,
        type: c.courseType,
        price: c.price,
        numLessons: c.numLessons,
        duration: c.lessonDuration,
        transmission: c.transmission,
        description: c.description,
        vehicleType: c.vehicleType,
        pickupAvailable: c.pickupAvailable,
        dropAvailable: c.dropAvailable,
      })),
      vehicles: school.vehicles.map((v: any) => ({
        id: v.id,
        brand: v.brand,
        model: v.model,
        type: v.vehicleType,
        transmission: v.transmission,
        year: v.year,
        imageUrl: v.imageUrl,
        isDualControl: v.isDualControl,
        hasAc: v.hasAc,
        safetyFeatures: JSON.parse(v.safetyFeaturesJson || "[]"),
      })),
      instructors: school.instructors.map((i: any) => ({
        id: i.id,
        name: i.name,
        phone: i.phone,
        experience: i.experienceYears,
        languages: JSON.parse(i.languagesJson || "[]"),
        specialization: JSON.parse(i.specializationJson || "[]"),
        verification: i.verificationStatus,
      })),
      galleries: school.galleries.map((g: any) => ({
        id: g.id,
        imageUrl: g.imageUrl,
        caption: g.caption,
      })),
      workingHours: JSON.parse(school.workingHoursJson || "{}"),
      reviews: school.reviews.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        studentName: r.student?.name || "Anonymous",
        createdAt: r.createdAt,
      })),
      status: school.status,
    };

    return ok({ school: response });
  } catch (error) {
    console.error("Error fetching school details:");
    return fail("Error fetching school details", 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await req.json();

    // Verify ownership (you'd check auth here)
    const school = await prisma.drivingSchool.findUnique({
      where: { id },
    });

    if (!school) {
      return fail("School not found", 404);
    }

    // Only owner can update
    const userId = data.userId; // From your auth system
    if (school.ownerId !== userId) {
      return fail("Unauthorized", 403);
    }

    const updated = await prisma.drivingSchool.update({
      where: { id },
      data: {
        schoolName: data.schoolName,
        description: data.description,
        phone: data.phone,
        email: data.email,
        address: data.address,
        area: data.area,
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        lat: data.lat,
        lng: data.lng,
        logoUrl: data.logoUrl,
        coverImageUrl: data.coverImageUrl,
        servicesJson: data.services ? JSON.stringify(data.services) : undefined,
        workingHoursJson: data.workingHours ? JSON.stringify(data.workingHours) : undefined,
        pickupAreasJson: data.pickupAreas ? JSON.stringify(data.pickupAreas) : undefined,
      },
    });

    return ok({ school: updated });
  } catch (error) {
    console.error("Error updating school:");
    return fail("Error updating school", 500);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = getSession();
  if (!session) return fail("Login required", 401);
  const { id } = await ctx.params;
  const school = await prisma.drivingSchool.findUnique({ where: { id } });
  if (!school) return fail("School not found", 404);
  const isOwner = session.role === "ADMIN" || school.ownerId === session.userId;
  if (!isOwner) return fail("Not authorized", 403);
  await prisma.drivingSchool.delete({ where: { id } });
  await audit("USER", session.userId, "DRIVING_SCHOOL_DELETE", "DrivingSchool", id, {});
  return ok({ deleted: true });
}
