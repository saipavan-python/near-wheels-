import type { Metadata } from "next";
import DriversClient from "./DriversClient";

export const metadata: Metadata = {
  title: "Need a Driver? — Near Wheels",
  description: "Find available drivers near you for your own vehicle — hourly or daily, verified and rated. Live location, trusted profiles.",
};

export default function DriversPage() {
  return <DriversClient />;
}
