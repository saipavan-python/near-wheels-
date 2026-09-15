/* eslint-disable no-console */
// Near Wheels seed — SAFE minimal seed for production.
// Does NOT wipe the database and does NOT create test providers/listings.
// Only ensures the admin account and subscription plans exist (idempotent).
const { PrismaClient } = require("@prisma/client");
const { scryptSync, randomBytes } = require("crypto");

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  console.log("Running Near Wheels seed (admin + plans only — no test data)…");

  // ── Plans (skip existing) ─────────────────────────────────────────
  const planSeeds = [
    { code: "FREE", name: "Free", monthlyFee: 0, commissionRate: 0.1, features: JSON.stringify(["Standard visibility", "10% commission"]) },
    { code: "PRO", name: "Pro", monthlyFee: 499, commissionRate: 0.06, features: JSON.stringify(["Priority in search", "6% commission", "Monthly insights"]) },
    { code: "BUSINESS", name: "Business", monthlyFee: 1499, commissionRate: 0.04, features: JSON.stringify(["Top placement", "4% commission", "Multi-listing tools"]) },
  ];
  for (const s of planSeeds) {
    const existing = await prisma.subscriptionPlan.findUnique({ where: { code: s.code } });
    if (!existing) await prisma.subscriptionPlan.create({ data: s });
  }
  console.log(`  subscriptionPlans: ${await prisma.subscriptionPlan.count()}`);

  // ── Admin user (only if missing — never touches real users) ──────
  const adminPhone = process.env.ADMIN_PHONE || "8096327356";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin@nearwheels";
  const existingAdmin = await prisma.user.findUnique({ where: { phone: adminPhone } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        phone: adminPhone,
        name: process.env.ADMIN_NAME || "Near Wheels Admin",
        role: "ADMIN",
        passwordHash: hashPassword(adminPassword),
      },
    });
  }
  console.log(`  users: ${await prisma.user.count()} (admin ensured, no test data created)`);
  console.log("Seed complete — nothing wiped, no providers/vehicles/garages created.");
  console.log("  admin login phone: " + adminPhone);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });