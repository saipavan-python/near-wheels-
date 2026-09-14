import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/vehicles",
          "/vehicles/",
          "/drivers",
          "/drivers/",
          "/garages",
          "/garages/",
          "/farm-services",
          "/drone-spraying",
          "/yatra-buses",
          "/yatra-buses/",
          "/learn-driving",
          "/share-my-ride",
          "/emergency",
          "/locations/",
        ],
        disallow: [
          "/api/",
          "/admin/",
          "/account",
          "/bookings",
          "/login",
          "/register",
          "/provider/",
          "/providers/dashboard",
          "/providers/vehicles/",
          "/providers/register",
          "/driving-school/",
          "/learn-driving/bookings",
          "/share-my-ride/offer",
          "/share-my-ride/find",
          "/share-my-ride/ride/",
          "/share-my-ride/live/",
          "/share-my-ride/my-rides",
          "/share-my-ride/my-bookings",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
