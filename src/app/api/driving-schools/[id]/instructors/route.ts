import { NextRequest } from "next/server";
import { ok, fail, readJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createInstructorSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email().optional(),
  experienceYears: z.number().min(0).optional(),
  languages: z.array(z.string()).optional(),
  specialization: z.array(z.string()).optional(),
  vehicleTypes: z.array(z.string()).optional(),
  photoUrl: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: schoolId } = await params;
    const data = await readJson(req);
    const body = createInstructorSchema.parse(data);

    // Verify school exists
    const school = await prisma.drivingSchool.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      return fail("School not found", 404);
    }

    const instructor = await prisma.drivingInstructor.create({
      data: {
        schoolId,
        name: body.name,
        phone: body.phone,
        email: body.email,
        experienceYears: body.experienceYears || 0,
        languagesJson: JSON.stringify(body.languages || []),
        specializationJson: JSON.stringify(body.specialization || []),
        vehicleTypeJson: JSON.stringify(body.vehicleTypes || []),
        photoUrl: body.photoUrl,
        verificationStatus: "PENDING",
        isActive: true,
      },
    });

    return ok({ instructor });
  } catch (error) {
    console.error("Error creating instructor:", error);
    if (error instanceof z.ZodError) {
      return fail("Validation error", 400);
    }
    return fail("Error creating instructor", 500);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: schoolId } = await params;

    const instructors = await prisma.drivingInstructor.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
    });

    const result = instructors.map((i) => ({
      ...i,
      languages: JSON.parse(i.languagesJson || "[]"),
      specialization: JSON.parse(i.specializationJson || "[]"),
      vehicleTypes: JSON.parse(i.vehicleTypeJson || "[]"),
    }));

    return ok({ instructors: result });
  } catch (error) {
    console.error("Error fetching instructors:", error);
    return fail("Error fetching instructors", 500);
  }
}
