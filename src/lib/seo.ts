export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://near-wheels.vercel.app").replace(/\/$/, "");

export const brand = "Near Wheels";
export const tagline = "Your journey. Your wheels.";

/** Returns a full URL for the given path. */
export const siteUrlFor = (path: string) => `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
