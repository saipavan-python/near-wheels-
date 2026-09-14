import type { Metadata } from "next";
import ServiceScreen from "@/components/ServiceScreen";

export const metadata: Metadata = {
  title: "Find a Garage Near You — Near Wheels",
  description: "Mechanics, towing, battery, tyre and breakdown help near your location — open now.",
};

export default function GaragesPage() {
  return (
    <ServiceScreen
      config={{
        searchType: "garages",
        eyebrow: "Garage & Repair",
        title: "Keep your wheels running.",
        subtitle:
          "Mechanics, towing, battery and tyre services nearby. For breakdowns, use Emergency for the fastest response.",
        quickFilters: [
          { label: "All", icon: "all", params: {} },
          { label: "Mechanic", icon: "mechanic", params: { serviceTypes: "MECHANIC" } },
          { label: "Towing", icon: "towing", params: { serviceTypes: "TOWING" } },
          { label: "Battery", icon: "battery", params: { serviceTypes: "BATTERY" } },
          { label: "Tyre", icon: "tyre", params: { serviceTypes: "TYRE" } },
          { label: "Electrical", icon: "electrical", params: { serviceTypes: "ELECTRICAL" } },
          { label: "AC repair", icon: "ac", params: { serviceTypes: "AC_REPAIR" } },
          { label: "Water wash", icon: "wash", params: { serviceTypes: "WATER_SERVICE" } },
        ],
      }}
    />
  );
}

