import { redirect } from "next/navigation";

export default async function OperatorYatraDashboard() {
  redirect("/providers/vehicles/register");
}