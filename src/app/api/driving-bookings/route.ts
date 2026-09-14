import { NextRequest } from "next/server";
import { ok, fail, readJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createBookingSchema = z.object({
  studentId: z.string(),
  schoolId: z.string(),
  courseId: z.string(),
  instructorId: z.string().optional(),
  vehicleId: z.string().optional(),
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().optional(),
  pickupLocation: z.string().optional(),
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  dropLocation: z.string().optional(),
  dropLat: z.number().optional(),
  dropLng: z.number().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const data = await readJson(req);
    const body = createBookingSchema.parse(data);

    // Verify course exists
    const course = await prisma.drivingCourse.findUnique({
      where: { id: body.courseId },
    });

    if (!course) {
      return fail("Course not found", 404);
    }

    // Generate booking code
    const code = `NW-DS-${Date.now().toString(36).toUpperCase()}`;

    const booking = await prisma.drivingBooking.create({
      data: {
        code,
        studentId: body.studentId,
        schoolId: body.schoolId,
        courseId: body.courseId,
        instructorId: body.instructorId,
        vehicleId: body.vehicleId,
        status: "PENDING",
        paymentStatus: "UNPAID",
        scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : undefined,
        scheduledTime: body.scheduledTime,
        pickupLocation: body.pickupLocation,
        pickupLat: body.pickupLat,
        pickupLng: body.pickupLng,
        dropLocation: body.dropLocation,
        dropLat: body.dropLat,
        dropLng: body.dropLng,
        baseAmount: course.price,
        totalAmount: course.price,
      },
      include: {
        school: { select: { schoolName: true } },
        course: { select: { courseName: true, price: true } },
      },
    });

    return ok({ booking });
  } catch (error) {
    console.error("Error creating booking:");
    if (error instanceof z.ZodError) {
      return fail("Validation error", 400);
    }
    return fail("Error creating booking", 500);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const schoolId = searchParams.get("schoolId");

    if (!studentId && !schoolId) {
      return fail("studentId or schoolId required", 400);
    }

    const bookings = await prisma.drivingBooking.findMany({
      where: {
        studentId: studentId || undefined,
        schoolId: schoolId || undefined,
      },
      include: {
        school: { select: { schoolName: true, logoUrl: true } },
        course: { select: { courseName: true } },
        instructor: { select: { name: true } },
        progress: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return ok({ bookings });
  } catch (error) {
    console.error("Error fetching bookings:");
    return fail("Error fetching bookings", 500);
  }
}
