/** @type {import('next').NextConfig} */
const noIndexHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const hsts = process.env.NODE_ENV === "production"
  ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
  : [];

const nextConfig = {
  poweredByHeader: false,
  images: { unoptimized: true },
  async rewrites() {
    return [
      { source: "/api/provider/:path*", destination: "/api/providers/:path*" },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(microphone; self), geolocation=(self)" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          ...hsts,
        ],
      },
      // API responses are NOT cached by default (dynamic route handlers).
      // Cache-Control for the fast public READ endpoints is set per-route in
      // their handlers (search, locations, share-rides) so only safe,
      // authenticated-to-everyone payloads get CDN-cached on the edge.
      { source: "/admin/:path*",  headers: noIndexHeaders },
      { source: "/account",       headers: noIndexHeaders },
      { source: "/bookings",      headers: noIndexHeaders },
      { source: "/login",         headers: noIndexHeaders },
      { source: "/register",      headers: noIndexHeaders },
      { source: "/provider/:path*", headers: noIndexHeaders },
      { source: "/providers/dashboard", headers: noIndexHeaders },
      { source: "/providers/vehicles/:path*", headers: noIndexHeaders },
      { source: "/providers/register", headers: noIndexHeaders },
      { source: "/driving-school/:path*", headers: noIndexHeaders },
      { source: "/learn-driving/bookings/:path*", headers: noIndexHeaders },
      { source: "/share-my-ride/offer",     headers: noIndexHeaders },
      { source: "/share-my-ride/find",      headers: noIndexHeaders },
      { source: "/share-my-ride/ride/:path*", headers: noIndexHeaders },
      { source: "/share-my-ride/live/:path*", headers: noIndexHeaders },
      { source: "/share-my-ride/my-rides",  headers: noIndexHeaders },
      { source: "/share-my-ride/my-bookings", headers: noIndexHeaders },
    ];
  },
};

module.exports = nextConfig;
