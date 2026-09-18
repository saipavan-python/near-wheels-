import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";

/**
 * GET /api/admin/share-rides
 * Recent offered rides with their bookings.
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return fail("Admin only", 403);
  const { searchParams } = new URL(req.url);
  const take = Number(searchParams.get("take") || 50);
  const rides = await prisma.sharedRide.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: { bookings: true },
  });
  return ok({ rides });
}

export const dynamic = "force-dynamic";