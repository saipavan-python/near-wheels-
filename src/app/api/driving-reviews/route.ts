import { NextRequest } from "next/server";
import { ok, fail, readJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createReviewSchema = z.object({
  bookingId: z.string().optional(),
  schoolId: z.string(),
  instructorId: z.string().optional(),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
  instructorRating: z.number().min(1).max(5).optional(),
  vehicleRating: z.number().min(1).max(5).optional(),
  teachingRating: z.number().min(1).max(5).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const data = await readJson(req);
    const body = createReviewSchema.parse(data);

    // Get student ID from auth (you'd get this from your auth system)
    const studentId = data.studentId;
    if (!studentId) {
      return fail("Student ID required", 400);
    }

    // Create review
    const review = await prisma.drivingReview.create({
      data: {
        bookingId: body.bookingId,
        studentId,
        schoolId: body.schoolId,
        instructorId: body.instructorId,
        rating: body.rating,
        comment: body.comment,
        instructorRating: body.instructorRating,
        vehicleRating: body.vehicleRating,
        teachingRating: body.teachingRating,
      },
    });

    // Update school rating
    const reviews = await prisma.drivingReview.findMany({
      where: { schoolId: body.schoolId },
      select: { rating: true },
    });

    const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

    await prisma.drivingSchool.update({
      where: { id: body.schoolId },
      data: {
        ratingAvg: Math.round(avgRating * 10) / 10,
        ratingCount: reviews.length,
      },
    });

    return ok({ review });
  } catch (error) {
    console.error("Error creating review:");
    if (error instanceof z.ZodError) {
      return fail("Validation error", 400);
    }
    return fail("Error creating review", 500);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("schoolId");
    const instructorId = searchParams.get("instructorId");

    if (!schoolId && !instructorId) {
      return fail("schoolId or instructorId required", 400);
    }

    const reviews = await prisma.drivingReview.findMany({
      where: {
        schoolId: schoolId || undefined,
        instructorId: instructorId || undefined,
      },
      include: {
        student: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return ok({ reviews });
  } catch (error) {
    console.error("Error fetching reviews:");
    return fail("Error fetching reviews", 500);
  }
}
