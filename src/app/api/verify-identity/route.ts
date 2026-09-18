import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { ok, fail } from "@/lib/http";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Identity verification — driving licence + government ID.
 * POST { driverLicenseNumber, idProofType, idProofNumber, driverLicensePhotoUrl?, idProofPhotoUrl? }
 *   → saves for the user, sets verificationStatus "PENDING".
 * GET  → current verification status + summary fields.
 */
export async function GET() {
  const session = getSession();
  if (!session) return fail("Login required", 401);
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      verificationStatus: true,
      driverLicenseNumber: true,
      idProofType: true,
      idProofNumber: true,
      driverLicenseImageUrl: true,
      idProofImageUrl: true,
      verifiedAt: true,
    },
  });
  if (!user) return fail("User not found", 404);

  return ok({
    status: user.verificationStatus || "UNVERIFIED",
    driverLicenseNumber: user.driverLicenseNumber || null,
    idProofType: user.idProofType || null,
    idProofNumber: user.idProofNumber || null,
    driverLicenseImageUrl: user.driverLicenseImageUrl || null,
    idProofImageUrl: user.idProofImageUrl || null,
    verifiedAt: user.verifiedAt,
  });
}

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) return fail("Login required", 401);

  const b = await req.json().catch(() => ({}));
  const driverLicenseNumber = String(b.driverLicenseNumber || "").trim();
  const idProofType = String(b.idProofType || "").trim().toUpperCase();
  const idProofNumber = String(b.idProofNumber || "").trim();
  const driverLicensePhotoUrl = String(b.driverLicensePhotoUrl || "").trim() || null;
  const idProofPhotoUrl = String(b.idProofPhotoUrl || "").trim() || null;

  if (!driverLicenseNumber) return fail("Driving licence number is required");
  if (!idProofType || !["AADHAAR", "PAN", "VOTER_ID", "PASSPORT"].includes(idProofType))
    return fail("Valid ID proof type is required (AADHAAR, PAN, VOTER_ID, PASSPORT)");
  if (!idProofNumber) return fail("ID proof number is required");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return fail("User not found", 404);

  await prisma.user.update({
    where: { id: session.userId },
    data: {
      driverLicenseNumber,
      driverLicenseImageUrl: driverLicensePhotoUrl,
      idProofType,
      idProofNumber,
      idProofImageUrl: idProofPhotoUrl,
      verificationStatus: "PENDING",
    },
  });

  return ok({
    status: "PENDING",
    message: "Identity documents submitted. Verification is pending review.",
  });
}