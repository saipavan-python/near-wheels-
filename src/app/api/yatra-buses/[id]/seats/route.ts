import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const pkg = await prisma.yatraBusPackage.findFirst({ where: { id: params.id, status: "PUBLISHED", isActive: true } });
  if (!pkg || pkg.departureDate < new Date()) return fail("This journey is no longer bookable", 404);
  const seats = await prisma.yatraSeat.findMany({ where: { packageId: pkg.id }, orderBy: { number: "asc" }, select: { number: true, status: true } });
  return ok({ seats });
}
