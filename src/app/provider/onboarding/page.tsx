"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CarFront, Bike, Truck, Bus, Tractor, Wrench, UserRound, GraduationCap, Cpu, Building2, MapPin, CheckCircle, ChevronRight, ArrowLeft, ShieldCheck, Sparkles, Plus, Check
} from "lucide-react";
import { api } from "@/lib/ui";

const CATEGORY_OPTIONS = [
  { id: "CAR", label: "Cars", icon: CarFront, desc: "Swift, Ertiga, Innova, SUVs", badge: "Vehicle" },
  { id: "BIKE", label: "Bikes & Scooters", icon: Bike, desc: "Activa, Shine, Pulsar", badge: "Vehicle" },
  { id: "AUTO", label: "Autos & Rickshaws", icon: CarFront, desc: "Passenger & Cargo Autos", badge: "Vehicle" },
  { id: "TRUCK", label: "Trucks & Pickups", icon: Truck, desc: "Bolero Pickup, 6-wheel trucks", badge: "Vehicle" },
  { id: "TRAVELLER", label: "Vans & Travellers", icon: Bus, desc: "12-26 seat mini buses", badge: "Vehicle" },
  { id: "TRACTOR", label: "Tractors", icon: Tractor, desc: "John Deere, Mahindra 45-60 HP", badge: "Equipment" },
  { id: "HARVESTER", label: "Harvesters", icon: Tractor, desc: "Paddy & Maize Combine Harvesters", badge: "Equipment" },
  { id: "CONSTRUCTION", label: "JCB & Construction", icon: Cpu, desc: "JCB Excavators, Backhoes, Loaders", badge: "Equipment" },
  { id: "DRIVER", label: "Professional Drivers", icon: UserRound, desc: "Hourly / Daily driver for hire", badge: "Service" },
  { id: "GARAGE", label: "Garage & Breakdown", icon: Wrench, desc: "Mechanic, Towing, Tyre, Battery", badge: "Service" },
  { id: "DRIVING_SCHOOL", label: "Driving School", icon: GraduationCap, desc: "Driving academy & motor school", badge: "Service" },
] as const;

export default function ProviderOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedCats, setSelectedCats] = useState<string[]>(["CAR"]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Business info
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [addressText, setAddressText] = useState("");
  const [locationText, setLocationText] = useState("Nandyal");

  // Type specific states
  const [carDetails, setCarDetails] = useState({ make: "Maruti", model: "Ertiga", seats: "7", fuelType: "PETROL", transmission: "MANUAL", ac: true, dailyRate: "2000", registrationNumber: "" });
  const [tractorDetails, setTractorDetails] = useState({ brand: "John Deere", model: "5310", hp: "55", engineHours: "1850", perAcre: "800", hourlyRate: "1200" });
  const [jcbDetails, setJcbDetails] = useState({ brand: "JCB", model: "3CX", hp: "76", operatingHours: "2100", bucketCapacity: "1.0 cu.m", hourlyRate: "1500" });
  const [garageDetails, setGarageDetails] = useState({ open24x7: true, opensAt: "08:00", closesAt: "20:00", visitCharge: "300", services: ["MECHANIC", "TOWING", "BATTERY", "TYRE"], emergency: false });
  const [driverDetails, setDriverDetails] = useState({ experienceYears: "5", licenseType: "LMV_TR", dailyRate: "900", hourlyRate: "130" });
  const [schoolDetails, setSchoolDetails] = useState({ schoolName: "", price: "4500" });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          if (d.user.name) setOwnerName(d.user.name);
          if (d.user.phone) setPhone(d.user.phone);
          if (d.user.name) setBusinessName(`${d.user.name} Services`);
        }
      })
      .catch(() => undefined);
  }, []);

  function toggleCat(catId: string) {
    if (selectedCats.includes(catId)) {
      if (selectedCats.length === 1) return;
      setSelectedCats(selectedCats.filter((c) => c !== catId));
    } else {
      setSelectedCats([...selectedCats, catId]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);

    const payload = {
      businessName: businessName.trim() || `${ownerName || "My"} Fleet Services`,
      phone: phone.replace(/\D/g, ""),
      ownerName: ownerName.trim(),
      addressText: addressText.trim() || locationText,
      locationText,
      categories: selectedCats,
      vehicles: {
        CAR: selectedCats.includes("CAR") ? carDetails : undefined,
        BIKE: selectedCats.includes("BIKE") ? { make: "Honda", model: "Activa", seats: "2", dailyRate: "400" } : undefined,
        AUTO: selectedCats.includes("AUTO") ? { make: "Bajaj", model: "RE", seats: "3", perKm: "18" } : undefined,
        TRUCK: selectedCats.includes("TRUCK") ? { make: "Tata", model: "Bolero Pickup", perKm: "30" } : undefined,
        TRAVELLER: selectedCats.includes("TRAVELLER") ? { make: "Force", model: "Traveller", seats: "12", perKm: "26" } : undefined,
      },
      equipment: {
        TRACTOR: selectedCats.includes("TRACTOR") ? tractorDetails : undefined,
        HARVESTER: selectedCats.includes("HARVESTER") ? { brand: "Class", model: "Crop Harvester", perAcre: "1600" } : undefined,
        CONSTRUCTION: selectedCats.includes("CONSTRUCTION") ? jcbDetails : undefined,
      },
      garage: selectedCats.includes("GARAGE") ? garageDetails : undefined,
      driver: selectedCats.includes("DRIVER") ? driverDetails : undefined,
      drivingSchool: selectedCats.includes("DRIVING_SCHOOL") ? { schoolName: schoolDetails.schoolName || `${businessName} Motor Driving School` } : undefined,
    };

    const r = await api<{ success: boolean; providerId: string; message: string }>("/api/provider/onboarding", { json: payload });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error || "Onboarding failed. Check inputs.");

    window.dispatchEvent(new Event("nw:auth"));
    router.push("/provider/dashboard");
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-paper/60 py-8 sm:py-12">
      <div className="container-nw max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-mute hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Exit Onboarding
          </Link>
          <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-extrabold text-brand-800">
            Step {step} of 2 — {step === 1 ? "Select Offerings" : "Asset & Business Details"}
          </span>
        </div>

        {/* Header card */}
        <div className="rounded-3xl border border-ink/10 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-brand-600">Provider Onboarding</p>
              <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                {step === 1 ? "What do you provide on Near Wheels?" : "Tell us about your fleet & business"}
              </h1>
              <p className="mt-1.5 text-sm text-ink-mute">
                {step === 1
                  ? "Select everything you own or offer. You can list 1 vehicle or hundreds of mixed assets."
                  : "We use standard Indian vehicle & equipment specifications to generate your live marketplace listings."}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-800">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Free Registration
            </span>
          </div>

          {err && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700 border border-red-200">{err}</p>}

          {/* STEP 1: CATEGORY SELECTOR */}
          {step === 1 && (
            <div className="mt-8 space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {CATEGORY_OPTIONS.map((cat) => {
                  const selected = selectedCats.includes(cat.id);
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCat(cat.id)}
                      className={`group relative flex flex-col rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-brand-600 bg-brand-50/60 ring-2 ring-brand-500 shadow-sm"
                          : "border-ink/10 bg-white hover:border-brand-300 hover:bg-paper/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`grid h-10 w-10 place-items-center rounded-xl transition ${selected ? "bg-brand-600 text-white" : "bg-paper text-ink-mute group-hover:bg-ink group-hover:text-white"}`}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${selected ? "bg-brand-200 text-brand-900" : "bg-paper text-ink-faint"}`}>
                          {cat.badge}
                        </span>
                      </div>

                      <p className="mt-3 font-bold text-ink leading-tight">{cat.label}</p>
                      <p className="mt-1 text-xs text-ink-mute leading-snug">{cat.desc}</p>

                      <div className={`mt-3 flex items-center gap-1.5 text-xs font-extrabold ${selected ? "text-brand-700" : "text-ink-faint"}`}>
                        <span className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${selected ? "bg-brand-600 text-white" : "border border-ink/20"}`}>
                          {selected ? "✓" : ""}
                        </span>
                        {selected ? "Selected" : "Click to add"}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-sky-900">Selected ({selectedCats.length}): {selectedCats.join(", ")}</p>
                  <p className="text-[11px] text-sky-700">You can add more vehicles, drivers or equipment later at any time from your Provider Workspace.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-primary shrink-0 !py-3 !px-6 text-sm font-bold shadow-md"
                >
                  Continue to Details <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: PROGRESSIVE DISCLOSURE FORM */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="mt-8 space-y-8">
              {/* Business Basics */}
              <div className="space-y-4 rounded-2xl border border-ink/10 bg-paper/40 p-5">
                <h3 className="flex items-center gap-2 font-bold text-ink text-base">
                  <Building2 className="h-5 w-5 text-brand-600" /> Business & Contact Info
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">Business / Enterprise Name *</label>
                    <input
                      required
                      className="input h-11"
                      placeholder="e.g. Sri Sai Travels / Ravi Farm Logistics"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Mobile Phone (OTP Verified) *</label>
                    <div className="flex items-center gap-2 rounded-xl border border-ink/15 bg-white px-3 h-11">
                      <span className="text-sm font-bold text-ink-mute">+91</span>
                      <input
                        required
                        inputMode="numeric"
                        className="w-full bg-transparent text-sm font-semibold outline-none"
                        placeholder="10-digit mobile"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Owner Full Name</label>
                    <input
                      className="input h-11"
                      placeholder="e.g. Pawan Kumar"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Base Town / City Location *</label>
                    <div className="relative">
                      <input
                        required
                        className="input h-11 pl-9"
                        placeholder="e.g. Nandyal"
                        value={locationText}
                        onChange={(e) => setLocationText(e.target.value)}
                      />
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-ink-faint" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Dynamic Sections per selected category */}
              {selectedCats.includes("CAR") && (
                <div className="space-y-4 rounded-2xl border border-brand-100 bg-brand-50/20 p-5">
                  <h3 className="flex items-center gap-2 font-bold text-ink text-base">
                    <CarFront className="h-5 w-5 text-brand-600" /> Car Listing Details
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="label">Make / Brand</label>
                      <input className="input h-11" value={carDetails.make} onChange={(e) => setCarDetails({ ...carDetails, make: e.target.value })} placeholder="Maruti, Toyota" />
                    </div>
                    <div>
                      <label className="label">Model Name</label>
                      <input className="input h-11" value={carDetails.model} onChange={(e) => setCarDetails({ ...carDetails, model: e.target.value })} placeholder="Ertiga, Innova" />
                    </div>
                    <div>
                      <label className="label">Seats</label>
                      <select className="input h-11" value={carDetails.seats} onChange={(e) => setCarDetails({ ...carDetails, seats: e.target.value })}>
                        <option value="5">5 Seats (Sedan/Hatchback)</option>
                        <option value="7">7 Seats (SUV/MUV)</option>
                        <option value="8">8 Seats (Large MUV)</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Fuel Type</label>
                      <select className="input h-11" value={carDetails.fuelType} onChange={(e) => setCarDetails({ ...carDetails, fuelType: e.target.value })}>
                        <option value="PETROL">Petrol</option>
                        <option value="DIESEL">Diesel</option>
                        <option value="CNG">CNG</option>
                        <option value="ELECTRIC">Electric</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Transmission</label>
                      <select className="input h-11" value={carDetails.transmission} onChange={(e) => setCarDetails({ ...carDetails, transmission: e.target.value })}>
                        <option value="MANUAL">Manual</option>
                        <option value="AUTOMATIC">Automatic</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Daily Rate (₹/day)</label>
                      <input type="number" className="input h-11" value={carDetails.dailyRate} onChange={(e) => setCarDetails({ ...carDetails, dailyRate: e.target.value })} placeholder="2000" />
                    </div>
                  </div>
                </div>
              )}

              {selectedCats.includes("TRACTOR") && (
                <div className="space-y-4 rounded-2xl border border-amber-100 bg-amber-50/30 p-5">
                  <h3 className="flex items-center gap-2 font-bold text-ink text-base">
                    <Tractor className="h-5 w-5 text-amber-600" /> Tractor Equipment Details
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="label">Brand & Model</label>
                      <input className="input h-11" value={tractorDetails.brand + " " + tractorDetails.model} onChange={(e) => setTractorDetails({ ...tractorDetails, brand: e.target.value })} placeholder="John Deere 5310" />
                    </div>
                    <div>
                      <label className="label">Horsepower (HP)</label>
                      <input type="number" className="input h-11" value={tractorDetails.hp} onChange={(e) => setTractorDetails({ ...tractorDetails, hp: e.target.value })} placeholder="55" />
                    </div>
                    <div>
                      <label className="label">Engine Hours</label>
                      <input type="number" className="input h-11" value={tractorDetails.engineHours} onChange={(e) => setTractorDetails({ ...tractorDetails, engineHours: e.target.value })} placeholder="1850" />
                    </div>
                    <div>
                      <label className="label">Rate per Acre (₹)</label>
                      <input type="number" className="input h-11" value={tractorDetails.perAcre} onChange={(e) => setTractorDetails({ ...tractorDetails, perAcre: e.target.value })} placeholder="800" />
                    </div>
                    <div>
                      <label className="label">Hourly Rate (₹)</label>
                      <input type="number" className="input h-11" value={tractorDetails.hourlyRate} onChange={(e) => setTractorDetails({ ...tractorDetails, hourlyRate: e.target.value })} placeholder="1200" />
                    </div>
                  </div>
                </div>
              )}

              {selectedCats.includes("CONSTRUCTION") && (
                <div className="space-y-4 rounded-2xl border border-purple-100 bg-purple-50/20 p-5">
                  <h3 className="flex items-center gap-2 font-bold text-ink text-base">
                    <Cpu className="h-5 w-5 text-purple-600" /> JCB / Construction Equipment Details
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="label">Equipment Type & Model</label>
                      <input className="input h-11" value={jcbDetails.brand + " " + jcbDetails.model} onChange={(e) => setJcbDetails({ ...jcbDetails, brand: e.target.value })} placeholder="JCB 3CX Backhoe Loader" />
                    </div>
                    <div>
                      <label className="label">Operating Hours</label>
                      <input type="number" className="input h-11" value={jcbDetails.operatingHours} onChange={(e) => setJcbDetails({ ...jcbDetails, operatingHours: e.target.value })} placeholder="2100" />
                    </div>
                    <div>
                      <label className="label">Hourly Rental Rate (₹/hr)</label>
                      <input type="number" className="input h-11" value={jcbDetails.hourlyRate} onChange={(e) => setJcbDetails({ ...jcbDetails, hourlyRate: e.target.value })} placeholder="1500" />
                    </div>
                  </div>
                </div>
              )}

              {selectedCats.includes("GARAGE") && (
                <div className="space-y-4 rounded-2xl border border-sky-100 bg-sky-50/30 p-5">
                  <h3 className="flex items-center gap-2 font-bold text-ink text-base">
                    <Wrench className="h-5 w-5 text-sky-600" /> Garage & Service Setup
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="label">Visit Charge (₹)</label>
                      <input type="number" className="input h-11" value={garageDetails.visitCharge} onChange={(e) => setGarageDetails({ ...garageDetails, visitCharge: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Opening Hours</label>
                      <div className="flex gap-2">
                        <input className="input h-11" value={garageDetails.opensAt} onChange={(e) => setGarageDetails({ ...garageDetails, opensAt: e.target.value })} />
                        <input className="input h-11" value={garageDetails.closesAt} onChange={(e) => setGarageDetails({ ...garageDetails, closesAt: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 pt-6">
                      <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                        <input type="checkbox" checked={garageDetails.open24x7} onChange={(e) => setGarageDetails({ ...garageDetails, open24x7: e.target.checked })} className="h-4 w-4 rounded accent-brand-600" />
                        Open 24×7 Emergency Service
                      </label>
                      <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                        <input type="checkbox" checked={garageDetails.emergency} onChange={(e) => setGarageDetails({ ...garageDetails, emergency: e.target.checked })} className="h-4 w-4 rounded accent-brand-600" />
                        Offer emergency / roadside response
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {selectedCats.includes("DRIVER") && (
                <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/20 p-5">
                  <h3 className="flex items-center gap-2 font-bold text-ink text-base">
                    <UserRound className="h-5 w-5 text-emerald-600" /> Driver Profile Setup
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="label">Experience (Years)</label>
                      <input type="number" className="input h-11" value={driverDetails.experienceYears} onChange={(e) => setDriverDetails({ ...driverDetails, experienceYears: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">License Type</label>
                      <select className="input h-11" value={driverDetails.licenseType} onChange={(e) => setDriverDetails({ ...driverDetails, licenseType: e.target.value })}>
                        <option value="LMV">LMV (Car / Jeep)</option>
                        <option value="LMV_TR">LMV-TR (Commercial Light)</option>
                        <option value="HMV">HMV (Heavy Goods / Bus)</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Daily Driver Rate (₹)</label>
                      <input type="number" className="input h-11" value={driverDetails.dailyRate} onChange={(e) => setDriverDetails({ ...driverDetails, dailyRate: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-ink/10">
                <button type="button" onClick={() => setStep(1)} className="btn-outline !py-3 !px-6 text-sm">
                  ← Back to Selection
                </button>
                <button type="submit" disabled={busy} className="btn-primary !py-3 !px-8 text-sm font-bold shadow-lg">
                  {busy ? "Setting Up Fleet…" : "Complete Registration →"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
