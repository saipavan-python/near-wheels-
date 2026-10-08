import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { parse } from "@/lib/utils";
import VehicleRegistrationForm from "@/components/VehicleRegistrationForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const runtime = "nodejs";

export default async function EditVehiclePage({ params }: { params: Promise<{  id: string  }> }) {
  const session = await getSession();
  if (!session) redirect(`/login?next=/providers/vehicles/${(await params).id}/edit`);
  if (session.role !== "PROVIDER" && session.role !== "ADMIN") redirect("/providers/register");

  const provider = await prisma.provider.findFirst({ where: { userId: session.userId } });
  if (!provider) redirect("/providers/register");

  const vehicle = await prisma.vehicle.findUnique({ where: { id: (await params).id } });
  if (!vehicle) notFound();
  if (vehicle.providerId !== provider.id && session.role !== "ADMIN") notFound();

  const rule = await prisma.pricingRule.findFirst({ where: { ownerProviderId: provider.id, targetId: vehicle.id } });

  const initial = {
    ...vehicle,
    images: parse(vehicle.imagesJson, []) as string[],
    pricing: rule ? { model: rule.model, dailyRate: rule.dailyRate, hourlyRate: rule.hourlyRate, deposit: rule.deposit, perKm: rule.perKm } : null,
  };

  return (
    <div className="container-nw max-w-3xl py-8">
      <Link href="/providers/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-mute hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>
      <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight">Edit {vehicle.title}</h1>
      <p className="mt-1 text-sm text-ink-mute">Update vehicle details. Changes are validated server-side and reflected immediately.</p>
      <div className="mt-6">
        <VehicleRegistrationForm mode="edit" initial={initial} vehicleId={vehicle.id} />
      </div>
    </div>
  );
}
