import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import VehicleRegistrationForm from "@/components/VehicleRegistrationForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Add Vehicle — Near Wheels Provider",
  description: "Register a new vehicle to your provider account.",
};

export default function AddVehiclePage() {
  const session = getSession();
  if (!session) redirect("/login?next=/providers/vehicles/add");
  if (session.role !== "PROVIDER" && session.role !== "ADMIN") redirect("/providers/register");

  return (
    <div className="container-nw max-w-3xl py-8">
      <Link href="/providers/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-mute hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>
      <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Register Your Vehicle</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-mute">
        Add another vehicle to your provider account — ABC Rentals example: Maruti Swift, Hyundai Creta, Toyota Innova, Kia Carens, Maruti Ertiga all belong to one account.
      </p>
      <div className="mt-6">
        <VehicleRegistrationForm mode="create" />
      </div>
    </div>
  );
}
