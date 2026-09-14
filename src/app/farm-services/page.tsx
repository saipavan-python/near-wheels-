import type { Metadata } from "next";
import ServiceScreen from "@/components/ServiceScreen";

export const metadata: Metadata = {
  title: "Farm Services & Spraying Drones Near You — Near Wheels",
  description:
    "Tractors, trailers, cultivators, rotavators, harvesters and crop-spraying drones by the acre or the day — near your farm.",
};

export default function FarmServicesPage() {
  return (
    <ServiceScreen
      config={{
        searchType: "farm",
        eyebrow: "Farm & Agri Services",
        title: "Machines for every acre.",
        subtitle:
          "Tractors, tillers, harvesters and crop-spraying drones — describe the task, we find the machine with per-acre or per-day pricing.",
        acresField: true,
        relatedLinks: [
          { label: "Book crop-spraying drones", href: "/drone-spraying", icon: "drone" },
        ],
        quickFilters: [
          { label: "All", icon: "all", params: {} },
          { label: "Tractor", icon: "tractor", params: { category: "TRACTOR" } },
          { label: "Tractor + Trailer", icon: "trailer", params: { category: "TRACTOR_TRAILER" } },
          { label: "Cultivator", icon: "cultivator", params: { category: "CULTIVATOR" } },
          { label: "Rotavator", icon: "rotavator", params: { category: "ROTAVATOR" } },
          { label: "Harvester", icon: "harvest", params: { category: "HARVESTER" } },
          { label: "Water tanker", icon: "water", params: { category: "WATER_TANKER" } },
          { label: "Farm transport", icon: "transport", params: { category: "FARM_TRANSPORT" } },
        ],
      }}
    />
  );
}
