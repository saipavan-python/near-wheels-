import type { Metadata } from "next";
import YatraBusPortal from "@/components/YatraBusPortal";

export const metadata: Metadata = {
  title: "Yatra Buses — Temple Devotional Packages | Near Wheels",
  description: "Book devotional temple packages for Tirupati, Srisailam, Bhadrachalam & more. Live seat counts and verified bus operators.",
};

export default function YatraBusesPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-10 md:py-16">
      <div className="container-nw">
        <YatraBusPortal />
      </div>
    </div>
  );
}
