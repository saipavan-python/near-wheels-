import { NextRequest } from "next/server";
import { ok, fail, readJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createCourseSchema = z.object({
  courseName: z.string().min(3),
  courseType: z.string(),
  numLessons: z.number().min(1),
  lessonDuration: z.number().min(15),
  price: z.number().min(0),
  description: z.string().optional(),
  vehicleType: z.string().optional(),
  transmission: z.string().optional(),
  pickupAvailable: z.boolean().optional(),
  dropAvailable: z.boolean().optional(),
  availableDays: z.array(z.number()).optional(),
  availableTimes: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: schoolId } = await params;
    const data = await readJson(req);
    const body = createCourseSchema.parse(data);

    // Verify school exists and user owns it
    const school = await prisma.drivingSchool.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      return fail("School not found", 404);
    }

    // Check ownership
    const userId = data.userId;
    if (school.ownerId !== userId) {
      return fail("Unauthorized", 403);
    }

    const course = await prisma.drivingCourse.create({
      data: {
        schoolId,
        courseName: body.courseName,
        courseType: body.courseType,
        numLessons: body.numLessons,
        lessonDuration: body.lessonDuration,
        price: body.price,
        description: body.description,
        vehicleType: body.vehicleType,
        transmission: body.transmission,
        pickupAvailable: body.pickupAvailable || false,
        dropAvailable: body.dropAvailable || false,
        availableDaysJson: JSON.stringify(body.availableDays || []),
        availableTimesJson: JSON.stringify(body.availableTimes || []),
        isActive: true,
      },
    });

    return ok({ course });
  } catch (error) {
    console.error("Error creating course:");
    if (error instanceof z.ZodError) {
      return fail("Validation error", 400);
    }
    return fail("Error creating course", 500);
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: schoolId } = await params;

    const courses = await prisma.drivingCourse.findMany({
      where: { schoolId, isActive: true },
      orderBy: { createdAt: "asc" },
    });

    const result = courses.map((c) => ({
      id: c.id,
      name: c.courseName,
      type: c.courseType,
      price: c.price,
      numLessons: c.numLessons,
      duration: c.lessonDuration,
      transmission: c.transmission,
      vehicleType: c.vehicleType,
      description: c.description,
      pickupAvailable: c.pickupAvailable,
      dropAvailable: c.dropAvailable,
      availableDays: JSON.parse(c.availableDaysJson || "[]"),
      availableTimes: JSON.parse(c.availableTimesJson || "[]"),
    }));

    return ok({ courses: result });
  } catch (error) {
    console.error("Error fetching courses:");
    return fail("Error fetching courses", 500);
  }
}
