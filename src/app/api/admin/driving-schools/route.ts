import { NextRequest } from "next/server";
import { ok, fail, readJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/services/auditService";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return fail("Admin only", 403);
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "PENDING_VERIFICATION";
    const page = Math.min(100, Math.max(1, parseInt(searchParams.get("page") || "1")));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const skip = (page - 1) * pageSize;

    const schools = await prisma.drivingSchool.findMany({
      where: {
        status,
      },
      include: {
        owner: { select: { name: true, phone: true } },
        documents: true,
      },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    });

    const total = await prisma.drivingSchool.count({
      where: { status },
    });

    return ok({
      schools,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching schools for verification:");
    return fail("Error fetching schools", 500);
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return fail("Admin only", 403);
  try {
    const data = await readJson(req);
    const { schoolId, status, reason } = data;

    if (!schoolId || !status) {
      return fail("schoolId and status required", 400);
    }

    const validStatuses = ["VERIFIED", "REJECTED", "SUSPENDED"];
    if (!validStatuses.includes(status)) {
      return fail("Invalid status", 400);
    }

    const school = await prisma.drivingSchool.update({
      where: { id: schoolId },
      data: {
        status,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        actorRole: "ADMIN",
        action: `School ${status.toLowerCase()}`,
        entity: "DrivingSchool",
        entityId: schoolId,
        detail: JSON.stringify({ reason }),
      },
    });

    return ok({ school });
  } catch (error) {
    console.error("Error updating school status:");
    return fail("Error updating school status", 500);
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return fail("Admin only", 403);
  const b = await readJson(req);
  const ids = b.ids || [];
  if (!Array.isArray(ids) || ids.length === 0) return fail("ids array required", 400);
  for (const id of ids) {
    const school = await prisma.drivingSchool.findUnique({ where: { id } });
    if (school && school.status !== "VERIFIED") {
      await prisma.drivingSchool.delete({ where: { id } });
      await audit("ADMIN", admin.userId, "SCHOOL_DELETE", "DrivingSchool", id, {});
    }
  }
  return ok({ deleted: true });
}

export const dynamic = "force-dynamic";