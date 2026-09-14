import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://nearwheels.example.com";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${base}/vehicles`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/drivers`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/garages`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/farm-services`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/drone-spraying`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/yatra-buses`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/learn-driving`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/share-my-ride`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/emergency`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, updatedAt: true },
      take: 100,
    });
    const vehicleRoutes: MetadataRoute.Sitemap = vehicles.map((v) => ({
      url: `${base}/vehicles/${v.id}`,
      lastModified: v.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    }));
    return [...staticRoutes, ...vehicleRoutes];
  } catch {
    return staticRoutes;
  }
}
