import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://nearwheels.example.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/vehicles/", "/drivers/", "/garages/", "/farm-services/", "/yatra-buses/", "/learn-driving/"],
        disallow: ["/api/", "/admin/", "/providers/dashboard", "/bookings", "/account", "/providers/vehicles/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
