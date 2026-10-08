import type { Metadata, Viewport } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MobileTabBar from "@/components/MobileTabBar";
import ChatWidget from "@/components/ChatWidget";
import LoginModal from "@/components/LoginModal";
import PageMotion from "@/components/motion/PageMotion";

import { siteUrl } from "@/lib/seo";

/* Fonts load at runtime via <link> (below) instead of next/font/google,
   which stalls builds when Google Fonts is unreachable. */

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Near Wheels – Car Rentals, Drivers & Vehicle Services Near You",
    template: "%s",
  },
  description:
    "Find nearby car rentals, professional drivers, garages and vehicle services with Near Wheels. Compare prices, availability and book local mobility services.",
  keywords: ["car rental", "drivers", "garage", "vehicle service", "mobility marketplace", "Near Wheels"],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Near Wheels – Car Rentals, Drivers & Vehicle Services",
    description:
      "Find nearby car rentals, professional drivers, garages and vehicle services with Near Wheels. Move better with AI concierge assistance.",
    type: "website",
    siteName: "Near Wheels",
    url: siteUrl,
    images: [
      { url: "/icon.svg", width: 512, height: 512, alt: "Near Wheels" },
      { url: "/og-image.jpg", width: 1200, height: 630, alt: "Near Wheels car rental and services" },
    ],
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Near Wheels – Car Rentals, Drivers & Vehicle Services Near You",
    description:
      "Find nearby car rentals, professional drivers, garages and vehicle services with Near Wheels. Compare prices, availability and book local mobility services.",
    images: ["/icon.svg", "/og-image.jpg"],
  },
  robots: { index: true, follow: true },
};

/* Insert JSON-LD into <head> - using hardcoded production URL */
const jsonLdMarkup = `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Near Wheels",
  "description": "A marketplace platform for India's road-transport and agri-services economy. Ride sharing, vehicle rentals, garages, driving schools, drone spraying, and bus operators in one premium mobility platform powered by an AI concierge that knows what's available near you.",
  "url": "https://near-wheels-q4bb.vercel.app",
  "logo": "/icon.svg",
  "sameAs": [
    "https://twitter.com/nearwheels",
    "https://facebook.com/nearwheels"
  ]
}
</script>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Near Wheels",
  "url": "https://near-wheels-q4bb.vercel.app",
  "description": "Find nearby car rentals, professional drivers, garages and vehicle services with Near Wheels.",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://near-wheels-q4bb.vercel.app/results?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
</script>
`;

/* eslint-disable-next-line @next/next/no-page-custom-font */
export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
        {jsonLdMarkup}
      </head>
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1 pb-16 lg:pb-0">
          <PageMotion>{children}</PageMotion>
        </main>
        <Footer />
        <MobileTabBar />
        <ChatWidget />
        <LoginModal />
      </body>
    </html>
  );
}