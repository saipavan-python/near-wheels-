import { prisma } from "../db";

export async function notifyUser(userId: string, title: string, body: string, link?: string, kind = "INFO") {
  await prisma.notification.create({ data: { userId, title, body, link, kind } });
}

export async function notifyProvider(providerId: string, title: string, body: string, link?: string, kind = "INFO") {
  await prisma.notification.create({ data: { providerId, title, body, link, kind } });
}
