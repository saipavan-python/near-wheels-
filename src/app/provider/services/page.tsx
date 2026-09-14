"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wrench, GraduationCap, ChevronRight, Clock, MapPin, CheckCircle2 } from "lucide-react";

export default function ServicesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/providers/me")
      .then((r) => r.json())
      .then((d) => {
        setLoading(false);
        if (d.ok) setData(d.data);
      })
      .catch(() => setLoading(false));
  }, []);

  const garage = data?.provider?.garageProfile;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Services & Facilities</h1>
        <p className="mt-1 text-xs text-ink-mute">
          Manage garage breakdown repair services and driving school training courses.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Garage Box */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-sky-600 font-bold">
              <Wrench className="h-6 w-6" />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold text-ink">Garage & Breakdown Services</h2>
            <p className="mt-1 text-xs text-slate-500">
              Mechanic, towing, tyre puncture, battery jumpstart & AC repair setup.
            </p>

            {garage ? (
              <div className="mt-4 rounded-xl bg-sky-50/50 p-3 text-xs space-y-1.5 border border-sky-100">
                <p className="font-bold text-sky-900">
                  {garage.open24x7 ? "Open 24×7 Emergency Service" : `Hours: ${garage.opensAt || "08:00"} - ${garage.closesAt || "20:00"}`}
                </p>
                <p className="text-slate-600">
                  Services: {JSON.parse(garage.services || '["MECHANIC"]').join(", ")}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-xs italic text-slate-400">No garage profile configured yet.</p>
            )}
          </div>

          <Link href="/provider/services/garage" className="mt-6 inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline">
            Manage Garage Profile →
          </Link>
        </div>

        {/* Driving School Box */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 font-bold">
              <GraduationCap className="h-6 w-6" />
            </span>
            <h2 className="mt-4 font-display text-lg font-bold text-ink">Driving School & Motor Academy</h2>
            <p className="mt-1 text-xs text-slate-500">
              Manage beginner driving courses, training vehicles, and lesson schedules.
            </p>
          </div>

          <Link href="/provider/services/driving-school" className="mt-6 inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline">
            Manage Driving School →
          </Link>
        </div>
      </div>
    </div>
  );
}
