import { redirect } from "next/navigation";

export default async function CreateYatraPackage() {
  redirect("/providers/vehicles/register");
}