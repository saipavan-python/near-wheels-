import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Share My Ride — Find or Offer Carpool Rides | Near Wheels",
  description:
    "Offer seats on your daily commute or find affordable shared rides near you — trusted verified riders, live tracking.",
  alternates: { canonical: "/share-my-ride" },
};

export default function ShareMyRideLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
