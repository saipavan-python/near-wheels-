import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Emergency Vehicle Assistance — 24×7 Help | Near Wheels",
  description:
    "Stuck on the road? Get emergency towing, battery jump, flat tyre or breakdown help near you — 24×7 verified mechanics.",
  alternates: { canonical: "/emergency" },
};

export default function EmergencyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
