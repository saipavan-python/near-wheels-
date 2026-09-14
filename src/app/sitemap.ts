import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/vehicles`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/drivers`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/garages`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/farm-services`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/drone-spraying`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/yatra-buses`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/learn-driving`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/share-my-ride`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/emergency`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/locations/kurnool`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/locations/nandyal`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
  ];

  try {
    const [vehicles, drivers, garages] = await Promise.all([
      prisma.vehicle.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, updatedAt: true },
        take: 100,
      }),
      prisma.driverProfile.findMany({
        where: { provider: { status: "ACTIVE" } },
        select: { id: true, provider: { select: { updatedAt: true } } },
        take: 100,
      }),
      prisma.garageProfile.findMany({
        where: { provider: { status: "ACTIVE" } },
        select: { id: true, provider: { select: { updatedAt: true } } },
        take: 100,
      }),
    ]);

    const vehicleRoutes: MetadataRoute.Sitemap = vehicles.map((v) => ({
      url: `${siteUrl}/vehicles/${v.id}`,
      lastModified: v.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    const driverRoutes: MetadataRoute.Sitemap = drivers.map((d) => ({
      url: `${siteUrl}/drivers/${d.id}`,
      lastModified: d.provider.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    const garageRoutes: MetadataRoute.Sitemap = garages.map((g) => ({
      url: `${siteUrl}/garages/${g.id}`,
      lastModified: g.provider.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    return [...staticRoutes, ...vehicleRoutes, ...driverRoutes, ...garageRoutes];
  } catch {
    return staticRoutes;
  }
}
