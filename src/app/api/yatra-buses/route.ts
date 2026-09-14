import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/http";
import { packageInclude, publicPackage, parseDateOnly } from "@/lib/services/yatraService";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from")?.trim().toLowerCase();
  const to = url.searchParams.get("to")?.trim().toLowerCase();
  const date = url.searchParams.get("date");
  const currentDate = parseDateOnly(url.searchParams.get("currentDate")) || new Date();

  const packages = await prisma.yatraBusPackage.findMany({
    where: {
      status: "PUBLISHED",
      isPublished: true,
      isActive: true,
      departureDate: { gte: currentDate },
      ...(date ? { departureDate: parseDateOnly(date) || undefined } : {}),
      ...(from || to
        ? { stops: { some: { name: { contains: from || to || "" } } } }
        : {}),
    },
    include: packageInclude,
    orderBy: { departureDate: "asc" },
  });

  return ok({ packages: packages.map(publicPackage) });
}
