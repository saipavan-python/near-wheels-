import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { packageInclude, publicPackage } from "@/lib/services/yatraService";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{  id: string  }> }) {
  const pkg = await prisma.yatraBusPackage.findFirst({
    where: { id: (await params).id, status: "PUBLISHED", isPublished: true, isActive: true, departureDate: { gte: new Date() } },
    include: packageInclude,
  });
  if (!pkg) return fail("Yatra journey not found or already departed", 404);
  return ok({ package: publicPackage(pkg) });
}
