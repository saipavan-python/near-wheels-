import { NextRequest } from "next/server";
import { ok, fail, readJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/services/auditService";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const booking = await prisma.drivingBooking.findUnique({
      where: { id },
      include: {
        student: { select: { name: true, phone: true, email: true } },
        school: { select: { schoolName: true, phone: true, address: true } },
        course: { select: { courseName: true, price: true, numLessons: true } },
        instructor: { select: { name: true } },
        vehicle: { select: { brand: true, model: true } },
        lesson: true,
        progress: true,
      },
    });

    if (!booking) {
      return fail("Booking not found", 404);
    }

    return ok({ booking });
  } catch (error) {
    console.error("Error fetching booking:", error);
    return fail("Error fetching booking", 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await readJson(req);

    const booking = await prisma.drivingBooking.findUnique({
      where: { id },
    });

    if (!booking) {
      return fail("Booking not found", 404);
    }

    const updated = await prisma.drivingBooking.update({
      where: { id },
      data: {
        status: data.status,
        paymentStatus: data.paymentStatus,
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        cancelReason: data.cancelReason,
        notes: data.notes,
      },
    });

    return ok({ booking: updated });
  } catch (error) {
    console.error("Error updating booking:", error);
    return fail("Error updating booking", 500);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = getSession();
  if (!session) return fail("Login required", 401);
  const { id } = await ctx.params;
  const booking = await prisma.drivingBooking.findUnique({ where: { id } });
  if (!booking) return fail("Booking not found", 404);
  const isStudent = booking.studentId === session.userId;
  const isSchool = booking.schoolId && booking.schoolId === session.userId;
  if (!isStudent && !isSchool && session.role !== "ADMIN") return fail("Not authorized", 403);
  await prisma.drivingBooking.delete({ where: { id } });
  await audit("USER", session.userId, "DRIVING_BOOKING_DELETE", "DrivingBooking", id, {});
  return ok({ deleted: true });
}
