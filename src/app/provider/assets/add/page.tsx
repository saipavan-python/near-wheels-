"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CarFront, Tractor, Cpu, Plus, Check } from "lucide-react";
import { api } from "@/lib/ui";

export default function AddAssetPage() {
  const router = useRouter();
  const [category, setCategory] = useState("CAR");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [title, setTitle] = useState("");
  const [seats, setSeats] = useState("4");
  const [fuelType, setFuelType] = useState("PETROL");
  const [transmission, setTransmission] = useState("MANUAL");
  const [regNumber, setRegNumber] = useState("");
  const [dailyRate, setDailyRate] = useState("");
  const [perKm, setPerKm] = useState("");
  const [perAcre, setPerAcre] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [hp, setHp] = useState("");
  const [engineHours, setEngineHours] = useState("");
  const [bucketCapacity, setBucketCapacity] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    const assetTitle = title.trim() || `${make || ""} ${model || category}`.trim();

    const payload = {
      category,
      make: make.trim() || "Standard",
      model: model.trim() || category,
      title: assetTitle,
      seats: Number(seats) || 4,
      fuelType,
      transmission,
      registrationNumber: regNumber.trim() || null,
      pricing: {
        model: category === "CAR" || category === "BIKE" ? "DAILY" : category === "AUTO" ? "PER_KM" : "PER_ACRE",
        dailyRate: dailyRate ? Number(dailyRate) : null,
        perKm: perKm ? Number(perKm) : null,
        perAcre: perAcre ? Number(perAcre) : null,
        hourlyRate: hourlyRate ? Number(hourlyRate) : null,
      },
      specs: {
        horsepower: hp ? Number(hp) : null,
        engineHours: engineHours ? Number(engineHours) : null,
        bucketCapacity: bucketCapacity || null,
      },
    };

    const r = await api<{ message: string }>("/api/provider/assets", { json: payload });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error || "Failed to add asset");

    router.push("/provider/assets");
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/provider/assets" className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to Assets
        </Link>
        <span className="text-xs font-bold text-brand-700">Add Asset</span>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <h1 className="font-display text-2xl font-extrabold text-ink">Add New Fleet Asset</h1>
        <p className="mt-1 text-xs text-slate-500">
          Specify technical details and pricing for your new vehicle, tractor, or heavy equipment.
        </p>

        {err && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">{err}</p>}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Category selection */}
          <div>
            <label className="label">Asset Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input h-11 text-sm font-semibold"
            >
              <option value="CAR">Car / SUV / MUV</option>
              <option value="BIKE">Bike / Scooter</option>
              <option value="AUTO">Passenger Auto / Cargo Auto</option>
              <option value="TRUCK">Pickup / Commercial Truck</option>
              <option value="VAN">Van / Traveller Mini-Bus</option>
              <option value="TRACTOR">Tractor (Agri Equipment)</option>
              <option value="HARVESTER">Combine Harvester</option>
              <option value="EXCAVATOR">JCB / Backhoe / Excavator</option>
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Make / Brand *</label>
              <input
                required
                className="input h-11"
                placeholder="e.g. Toyota / John Deere / JCB"
                value={make}
                onChange={(e) => setMake(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Model Name *</label>
              <input
                required
                className="input h-11"
                placeholder="e.g. Innova / 5310 / 3CX"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Listing Title (Optional display title)</label>
            <input
              className="input h-11"
              placeholder={`Default: ${make || "Brand"} ${model || "Model"}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Conditional Fields based on category */}
          {["CAR", "BIKE", "AUTO", "TRUCK", "VAN"].includes(category) && (
            <div className="grid gap-4 sm:grid-cols-3 rounded-2xl bg-slate-50 p-4 border border-slate-200">
              <div>
                <label className="label">Seating Capacity</label>
                <input type="number" className="input h-11" value={seats} onChange={(e) => setSeats(e.target.value)} />
              </div>
              <div>
                <label className="label">Fuel Type</label>
                <select className="input h-11" value={fuelType} onChange={(e) => setFuelType(e.target.value)}>
                  <option value="PETROL">Petrol</option>
                  <option value="DIESEL">Diesel</option>
                  <option value="CNG">CNG</option>
                  <option value="ELECTRIC">Electric</option>
                </select>
              </div>
              <div>
                <label className="label">Registration Number</label>
                <input className="input h-11 uppercase font-mono" placeholder="Enter registration number" value={regNumber} onChange={(e) => setRegNumber(e.target.value)} />
              </div>
            </div>
          )}

          {["TRACTOR", "HARVESTER", "EXCAVATOR"].includes(category) && (
            <div className="grid gap-4 sm:grid-cols-3 rounded-2xl bg-amber-50/40 p-4 border border-amber-200">
              <div>
                <label className="label">Horsepower (HP)</label>
                <input type="number" className="input h-11" placeholder="55" value={hp} onChange={(e) => setHp(e.target.value)} />
              </div>
              <div>
                <label className="label">Engine / Operating Hours</label>
                <input type="number" className="input h-11" placeholder="1850" value={engineHours} onChange={(e) => setEngineHours(e.target.value)} />
              </div>
              <div>
                <label className="label">Bucket / Capacity</label>
                <input className="input h-11" placeholder="1.0 cu.m" value={bucketCapacity} onChange={(e) => setBucketCapacity(e.target.value)} />
              </div>
            </div>
          )}

          {/* Pricing inputs */}
          <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">Rental Rates Setup</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label">Daily Rate (₹/day)</label>
                <input type="number" className="input h-11" placeholder="2000" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} />
              </div>
              <div>
                <label className="label">Per Km Rate (₹/km)</label>
                <input type="number" className="input h-11" placeholder="18" value={perKm} onChange={(e) => setPerKm(e.target.value)} />
              </div>
              <div>
                <label className="label">Per Acre / Hourly Rate (₹)</label>
                <input type="number" className="input h-11" placeholder="800" value={perAcre || hourlyRate} onChange={(e) => { setPerAcre(e.target.value); setHourlyRate(e.target.value); }} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Link href="/provider/assets" className="btn-outline !py-2.5 !px-5 text-xs font-bold">
              Cancel
            </Link>
            <button type="submit" disabled={busy} className="btn-primary !py-2.5 !px-6 text-xs font-bold shadow-md">
              {busy ? "Saving Asset…" : "Publish Asset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
