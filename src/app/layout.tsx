import type { Metadata, Viewport } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MobileTabBar from "@/components/MobileTabBar";
import ChatWidget from "@/components/ChatWidget";
import LoginModal from "@/components/LoginModal";
import PageMotion from "@/components/motion/PageMotion";

/* Fonts load at runtime via <link> (below) instead of next/font/google,
   which stalls builds when Google Fonts is unreachable. */

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nearwheels.example.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Near Wheels — Your journey. Your wheels.",
    template: "%s | Near Wheels",
  },
  description:
    "Rent cars, book professional drivers and find trusted garages — all in one premium mobility platform, powered by an AI concierge that knows what's available near you.",
  keywords: ["car rental", "drivers", "garage", "vehicle service", "mobility marketplace", "Near Wheels"],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Near Wheels — Your journey. Your wheels.",
    description:
      "Find the right wheels. Book the right service. Move better — vehicles, drivers and garages in one place.",
    type: "website",
    siteName: "Near Wheels",
    url: siteUrl,
    images: [{ url: "/icon.svg", width: 512, height: 512, alt: "Near Wheels" }],
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image", title: "Near Wheels", images: ["/icon.svg"] },
  robots: { index: true, follow: true },
};

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
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
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
