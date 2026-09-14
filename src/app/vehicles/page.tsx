import type { Metadata } from "next";
import VehiclesClient from "./VehiclesClient";

export const metadata: Metadata = {
  title: "Find a Vehicle Near You — Near Wheels",
  description: "Cars, autos, bikes, SUVs, vans, pickups and trucks nearby. Self-drive or with driver, available now or later.",
};

export default function VehiclesPage() {
  return <VehiclesClient />;
}

