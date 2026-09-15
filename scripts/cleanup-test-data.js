/* Near Wheels — remove all seeded/test marketplace data from the live DB.
   Keeps: admin user, real customer accounts, locations, subscription plans, app settings, analytics. */
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const TEST_USER_NAMES = ["Pawan (demo)", "CRUD Tester", "CRUD Repro"];
const TEST_USER_PHONES = ["9000000002"];

async function log(label, count) {
  console.log(`  ${label}: ${count}`);
}

async function main() {
  console.log("Removing test marketplace data from live DB…");

  const providers = await p.provider.findMany({ select: { id: true, businessName: true, type: true } });
  console.log(`\nProviders to delete (${providers.length}):`);
  for (const pr of providers) console.log(`  - [${pr.type}] ${pr.businessName}`);
  const providerIds = providers.map((x) => x.id);

  const testUsers = await p.user.findMany({
    where: { OR: [{ name: { in: TEST_USER_NAMES } }, { phone: { in: TEST_USER_PHONES } }] },
  });
  const testUserIds = testUsers.map((u) => u.id);
  console.log(`\nTest users to delete (${testUsers.length}):`, testUsers.map((u) => `${u.name || "?"}(${u.phone})`).join(", "));
  const keepUsers = await p.user.findMany({ where: { id: { notIn: testUserIds } } });
  console.log(`Users to KEEP (${keepUsers.length}):`, keepUsers.map((u) => `${u.name || "?"}(${u.phone}) [${u.role}]`).join(", "));

  // 1. payments / payouts / commissions
  log("payment", await p.payment.deleteMany());
  log("payout", await p.payout.deleteMany());
  log("commissionRecord", await p.commissionRecord.deleteMany());

  // 2. reviews / favorites / notifications
  log("review", await p.review.deleteMany());
  log("favorite", await p.favorite.deleteMany());
  log("notification", await p.notification.deleteMany());

  // 3. booking chat + bookings
  const bookings = await p.booking.findMany({ select: { id: true } });
  const bookingIds = bookings.map((b) => b.id);
  log("bookingChatParticipant", await p.bookingChatParticipant.deleteMany());
  log("bookingChatMessage", await p.bookingChatMessage.deleteMany());
  log("booking", await p.booking.deleteMany());

  // 4. yatra (empty now, but safe)
  log("yatraSeat", await p.yatraSeat.deleteMany());
  log("yatraTempleStop", await p.yatraTempleStop.deleteMany());
  log("yatraBooking", await p.yatraBooking.deleteMany());
  log("yatraBusPackage", await p.yatraBusPackage.deleteMany());

  // 5. shared-ride sample data
  log("sharedRideBooking", await p.sharedRideBooking.deleteMany());
  log("sharedRide", await p.sharedRide.deleteMany());

  // 6. provider-owned marketplistings
  log("vehicleAvailability", await p.vehicleAvailability.deleteMany());
  log("maintenanceRecord", await p.maintenanceRecord.deleteMany());
  log("vehicle", await p.vehicle.deleteMany());
  log("driverAvailability", await p.driverAvailability.deleteMany());
  log("driver", await p.driver.deleteMany());
  log("driverProfile", await p.driverProfile.deleteMany());
  log("garageProfile", await p.garageProfile.deleteMany());
  log("farmEquipment", await p.farmEquipment.deleteMany());
  log("droneProfile", await p.droneProfile.deleteMany());

  // 7. pricing rules + subscriptions
  log("pricingRule", await p.pricingRule.deleteMany());
  log("providerSubscription", await p.providerSubscription.deleteMany());

  // 8. provider services / locations / members
  log("providerServiceItem", await p.providerServiceItem.deleteMany());
  log("providerService", await p.providerService.deleteMany());
  log("providerLocation", await p.providerLocation.deleteMany());
  log("providerMember", await p.providerMember.deleteMany());

  // 9. conversations owned by test users (AI chat)
  const convs = await p.conversation.findMany({ where: { customerId: { in: testUserIds } }, select: { id: true } });
  const convIds = convs.map((c) => c.id);
  log("message", await p.message.deleteMany({ where: { conversationId: { in: convIds } } }));
  log("conversation", await p.conversation.deleteMany({ where: { id: { in: convIds } } }));

  // 10. providers themselves
  log("provider", await p.provider.deleteMany());

  // 11. test users
  log("session", await p.session.deleteMany({ where: { userId: { in: testUserIds } } }));
  log("loginEvent", await p.loginEvent.deleteMany({ where: { userId: { in: testUserIds } } }));
  log("otpCode", await p.otpCode.deleteMany({ where: { phone: { in: TEST_USER_PHONES } } }));
  log("user", await p.user.deleteMany({ where: { id: { in: testUserIds } } }));

  const summary = {
    providers: await p.provider.count(),
    vehicles: await p.vehicle.count(),
    driverProfiles: await p.driverProfile.count(),
    garages: await p.garageProfile.count(),
    farm: await p.farmEquipment.count(),
    drones: await p.droneProfile.count(),
    rosterDrivers: await p.driver.count(),
    bookings: await p.booking.count(),
    sharedRides: await p.sharedRide.count(),
    users: await p.user.count(),
    locations: await p.location.count(),
    plans: await p.subscriptionPlan.count(),
  };
  console.log("\nRemaining counts:", JSON.stringify(summary, null, 2));
  await p.$disconnect();
}

main().catch((e) => { console.error("CLEANUP FAILED:", e.message); process.exit(1); });