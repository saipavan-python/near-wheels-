import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { getSession } from "@/lib/session";
import { operatorForUser } from "@/lib/services/yatraService";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) return fail("Authentication required", 401);
  const operator = await operatorForUser(session.userId);
  if (!operator) return fail("Vehicle-owner access required", 403);
  const pkg = await prisma.yatraBusPackage.findFirst({ where: { id: params.id, operatorId: operator.id }, include: { stops: true } });
  if (!pkg) return fail("Package not found", 404);
  if (pkg.stops.length < 1) return fail("Add at least one temple stop before publishing");
  if (pkg.departureDate < new Date()) return fail("Departure date cannot be in the past");
  const updated = await prisma.yatraBusPackage.update({ where: { id: pkg.id }, data: { status: "PUBLISHED", isPublished: true, isActive: true } });
  return ok({ package: updated });
}
