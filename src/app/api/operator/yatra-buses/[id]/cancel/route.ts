import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { getSession } from "@/lib/session";
import { operatorForUser } from "@/lib/services/yatraService";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return fail("Authentication required", 401);
  const operator = await operatorForUser(session.userId);
  if (!operator) return fail("Vehicle-owner access required", 403);
  const result = await prisma.yatraBusPackage.updateMany({ where: { id: params.id, operatorId: operator.id }, data: { status: "CANCELLED", isPublished: false, isActive: false } });
  if (!result.count) return fail("Package not found", 404);
  return ok({ cancelled: true });
}
