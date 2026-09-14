import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Become a Provider — Near Wheels",
  description:
    "List your vehicle, register as a driver, add your garage, farm equipment or drone service on Near Wheels — free to list, commission only on completed bookings.",
  robots: { index: true, follow: true },
};

export default function ProvidersRegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}