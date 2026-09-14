import type { Metadata } from "next";
import ServiceScreen from "@/components/ServiceScreen";

export const metadata: Metadata = {
  title: "Drone Spraying Services — Near Wheels",
  description: "Verified drone operators for precision crop spraying — per-acre pricing, capacity and availability upfront.",
};

export default function DroneSprayingPage() {
  return (
    <ServiceScreen
      config={{
        searchType: "drones",
        eyebrow: "Farm Spraying Drones",
        title: "Precision spraying, acre by acre.",
        subtitle:
          "Part of Near Wheels farm services — book verified drone operators for pesticide, fungicide and nutrient spraying. Per-acre pricing, upfront.",
        acresField: true,
        relatedLinks: [
          { label: "Tractors & farm equipment", href: "/farm-services", icon: "tractor" },
        ],
      }}
    />
  );
}

