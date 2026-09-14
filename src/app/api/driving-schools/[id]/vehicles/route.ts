import { NextRequest } from "next/server";
import { ok, fail, readJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createVehicleSchema = z.object({
  brand: z.string().min(2),
  model: z.string().min(2),
  vehicleType: z.string(),
  transmission: z.string(),
  year: z.number().min(1900),
  registrationNumber: z.string(),
  imageUrl: z.string().optional(),
  safetyFeatures: z.array(z.string()).optional(),
  isDualControl: z.boolean().optional(),
  hasAc: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: schoolId } = await params;
    const data = await readJson(req);
    const body = createVehicleSchema.parse(data);

    // Verify school exists
    const school = await prisma.drivingSchool.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      return fail("School not found", 404);
    }

    const vehicle = await prisma.trainingVehicle.create({
      data: {
        schoolId,
        brand: body.brand,
        model: body.model,
        vehicleType: body.vehicleType,
        transmission: body.transmission,
        year: body.year,
        registrationNumber: body.registrationNumber,
        imageUrl: body.imageUrl,
        safetyFeaturesJson: JSON.stringify(body.safetyFeatures || []),
        isDualControl: body.isDualControl ?? true,
        hasAc: body.hasAc ?? true,
        status: "ACTIVE",
      },
    });

    return ok({ vehicle });
  } catch (error) {
    console.error("Error creating vehicle:");
    if (error instanceof z.ZodError) {
      return fail("Validation error", 400);
    }
    return fail("Error creating vehicle", 500);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: schoolId } = await params;

    const vehicles = await prisma.trainingVehicle.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
    });

    const result = vehicles.map((v) => ({
      ...v,
      safetyFeatures: JSON.parse(v.safetyFeaturesJson || "[]"),
    }));

    return ok({ vehicles: result });
  } catch (error) {
    console.error("Error fetching vehicles:");
    return fail("Error fetching vehicles", 500);
  }
}
