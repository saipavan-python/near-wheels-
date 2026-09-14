"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/ui";
import LocationPicker from "./LocationPicker";
import { getVehicleConfig, VEHICLE_CATEGORIES, type VehicleCategory } from "@/lib/vehicleConfig";
import { Upload, X, ImageIcon, CarFront, MapPin, IndianRupee } from "lucide-react";

type Props = {
  mode?: "create" | "edit";
  initial?: any;
  vehicleId?: string;
  onDone?: () => void;
};

export default function VehicleRegistrationForm({ mode = "create", initial, vehicleId, onDone }: Props) {
  const router = useRouter();
  const [category, setCategory] = useState<VehicleCategory>((initial?.category as VehicleCategory) || "CAR");
  const cfg = getVehicleConfig(category);

  const [make, setMake] = useState(initial?.make || "");
  const [model, setModel] = useState(initial?.model || "");
  const [variant, setVariant] = useState(initial?.variant || "");
  const [year, setYear] = useState<string>(initial?.year ? String(initial.year) : "");
  const [registrationNumber, setRegistrationNumber] = useState(initial?.registrationNumber || "");
  const [seats, setSeats] = useState(initial?.seats || cfg.defaults.seats);
  const [transmission, setTransmission] = useState(initial?.transmission || cfg.defaults.transmission);
  const [fuelType, setFuelType] = useState(initial?.fuelType || cfg.defaults.fuelType);
  const [color, setColor] = useState(initial?.color || "");
  const [ac, setAc] = useState(initial?.ac ?? true);
  const [selfDrive, setSelfDrive] = useState(initial?.selfDriveAllowed ?? cfg.defaults.selfDrive);
  const [withDriver, setWithDriver] = useState(initial?.withDriverAllowed ?? true);
  const [loadTons, setLoadTons] = useState(initial?.loadCapacityTons ? String(initial.loadCapacityTons) : "");

  const [pricePerDay, setPricePerDay] = useState(initial?.pricing?.dailyRate ? String(initial.pricing.dailyRate) : "");
  const [pricePerHour, setPricePerHour] = useState(initial?.pricing?.hourlyRate ? String(initial.pricing.hourlyRate) : "");
  const [deposit, setDeposit] = useState(initial?.pricing?.deposit ? String(initial.pricing.deposit) : "");
  const [pricingModel, setPricingModel] = useState(initial?.pricing?.model || cfg.pricingModels[0] || "DAILY");

  const [loc, setLoc] = useState<{ label: string; lat?: number; lng?: number } | null>(
    initial?.pickupAddress || initial?.pickupLat ? { label: initial.pickupAddress || "", lat: initial.pickupLat, lng: initial.pickupLng } : null
  );

  const [images, setImages] = useState<string[]>(() => {
    if (initial?.images && initial.images.length) return initial.images;
    if (initial?.imageUrl) return [initial.imageUrl];
    if (initial?.imagesJson) {
      try { const arr = JSON.parse(initial.imagesJson); if (Array.isArray(arr)) return arr; } catch {}
    }
    return [];
  });
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrs, setFieldErrs] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowed.includes(file.type)) return setErr("Only JPEG, PNG, WebP allowed");
    if (file.size > 5 * 1024 * 1024) return setErr("Max 5 MB");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) setErr(data.error || "Upload failed");
      else setImages((cur) => [...cur, data.url].slice(0, 10));
    } catch {
      setErr("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!make.trim()) e.make = "Make required";
    if (!model.trim()) e.model = "Model required";
    if (!category) e.category = "Type required";
    if (seats < 1) e.seats = "Seats required";
    if (pricePerDay && (Number(pricePerDay) < 100)) e.pricePerDay = "Min ₹100";
    setFieldErrs(e);
    return Object.keys(e).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!validate()) return setErr("Fix highlighted fields");
    setBusy(true);
    const payload: any = {
      category,
      make: make.trim(),
      model: model.trim(),
      variant: variant.trim() || undefined,
      year: year ? Number(year) : undefined,
      registrationNumber: registrationNumber.trim() || undefined,
      seats: Number(seats),
      transmission: transmission || undefined,
      fuelType: fuelType || undefined,
      color: color.trim() || undefined,
      ac,
      selfDriveAllowed: selfDrive,
      withDriverAllowed: withDriver,
      loadCapacityTons: loadTons ? Number(loadTons) : undefined,
      images,
      imageUrl: images[0] || undefined,
      pickupAddress: loc?.label || undefined,
      pickupLat: loc?.lat ?? undefined,
      pickupLng: loc?.lng ?? undefined,
      pricing: {
        model: pricingModel,
        dailyRate: pricePerDay ? Number(pricePerDay) : undefined,
        hourlyRate: pricePerHour ? Number(pricePerHour) : undefined,
        deposit: deposit ? Number(deposit) : undefined,
      },
    };

    const url = mode === "edit" && vehicleId ? `/api/providers/vehicles/${vehicleId}` : "/api/providers/vehicles";
    const method = mode === "edit" ? "PATCH" : "POST";
    const r = await api(url, { method, json: payload });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error || "Failed to save vehicle");
    if (onDone) onDone();
    else router.push("/providers/dashboard");
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Basic Information */}
      <section className="card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-bold"><CarFront className="h-4 w-4 text-brand-600" /> Basic Information</h2>
        <p className="text-xs text-ink-mute">Tell customers what they will drive.</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Vehicle type *</label>
            <select className="input h-12" value={category} onChange={(e) => setCategory(e.target.value as VehicleCategory)}>
              {VEHICLE_CATEGORIES.map((c) => {
                const cc = getVehicleConfig(c);
                return <option key={c} value={c}>{cc.label} — {c}</option>;
              })}
            </select>
            {fieldErrs.category && <p className="text-xs text-red-600">{fieldErrs.category}</p>}
          </div>

          <div>
            <label className="label">Make *</label>
            <input className="input h-12" value={make} onChange={(e) => setMake(e.target.value)} placeholder="e.g. Maruti" />
            {fieldErrs.make && <p className="text-xs text-red-600">{fieldErrs.make}</p>}
          </div>
          <div>
            <label className="label">Model *</label>
            <input className="input h-12" value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Swift, Ertiga, Innova" />
            {fieldErrs.model && <p className="text-xs text-red-600">{fieldErrs.model}</p>}
          </div>
          <div>
            <label className="label">Variant</label>
            <input className="input h-12" value={variant} onChange={(e) => setVariant(e.target.value)} placeholder="e.g. VXi, ZDi" />
          </div>
          <div>
            <label className="label">Year</label>
            <input className="input h-12" type="number" min={1990} max={2030} value={year} onChange={(e) => setYear(e.target.value)} placeholder="2022" />
          </div>
          <div>
            <label className="label">Registration number</label>
            <input className="input h-12" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())} placeholder="Enter registration number" />
          </div>
          <div>
            <label className="label">Color</label>
            <input className="input h-12" value={color} onChange={(e) => setColor(e.target.value)} placeholder="White, Silver" />
          </div>
          <div>
            <label className="label">Seating capacity *</label>
            <input className="input h-12" type="number" min={1} max={50} value={seats} onChange={(e) => setSeats(Number(e.target.value) || 4)} />
          </div>
          <div>
            <label className="label">Transmission</label>
            <select className="input h-12" value={transmission} onChange={(e) => setTransmission(e.target.value)}>
              <option value="MANUAL">MANUAL</option>
              <option value="AUTOMATIC">AUTOMATIC</option>
            </select>
          </div>
          <div>
            <label className="label">Fuel type</label>
            <select className="input h-12" value={fuelType} onChange={(e) => setFuelType(e.target.value)}>
              <option value="PETROL">PETROL</option>
              <option value="DIESEL">DIESEL</option>
              <option value="CNG">CNG</option>
              <option value="ELECTRIC">ELECTRIC</option>
            </select>
          </div>
          {category === "TRUCK" || category === "PICKUP" ? (
            <div>
              <label className="label">Load capacity (tons)</label>
              <input className="input h-12" type="number" step="0.5" value={loadTons} onChange={(e) => setLoadTons(e.target.value)} placeholder="1.5" />
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex h-12 items-center gap-2 rounded-xl border border-ink/15 bg-white px-3">
            <input type="checkbox" checked={ac} onChange={(e) => setAc(e.target.checked)} className="h-5 w-5 accent-brand-600" />
            <span className="text-sm font-medium">AC</span>
          </label>
          <label className="flex h-12 items-center gap-2 rounded-xl border border-ink/15 bg-white px-3">
            <input type="checkbox" checked={selfDrive} onChange={(e) => setSelfDrive(e.target.checked)} className="h-5 w-5 accent-brand-600" />
            <span className="text-sm font-medium">Self-drive allowed</span>
          </label>
          <label className="flex h-12 items-center gap-2 rounded-xl border border-ink/15 bg-white px-3">
            <input type="checkbox" checked={withDriver} onChange={(e) => setWithDriver(e.target.checked)} className="h-5 w-5 accent-brand-600" />
            <span className="text-sm font-medium">With driver</span>
          </label>
        </div>
      </section>

      {/* Rental Information */}
      <section className="card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-bold"><IndianRupee className="h-4 w-4 text-brand-600" /> Rental Information</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Pricing model</label>
            <select className="input h-12" value={pricingModel} onChange={(e) => setPricingModel(e.target.value)}>
              <option value="DAILY">Per day</option>
              <option value="HOURLY">Per hour</option>
              <option value="PER_KM">Per km</option>
              <option value="PER_TRIP">Per trip</option>
            </select>
          </div>
          <div>
            <label className="label">Price per day (₹)</label>
            <input className="input h-12" type="number" min={100} value={pricePerDay} onChange={(e) => setPricePerDay(e.target.value)} placeholder="2500" />
            {fieldErrs.pricePerDay && <p className="text-xs text-red-600">{fieldErrs.pricePerDay}</p>}
          </div>
          <div>
            <label className="label">Price per hour (₹)</label>
            <input className="input h-12" type="number" min={50} value={pricePerHour} onChange={(e) => setPricePerHour(e.target.value)} placeholder="300" />
          </div>
          <div>
            <label className="label">Security deposit (₹)</label>
            <input className="input h-12" type="number" min={0} value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="2000" />
          </div>
          <div className="sm:col-span-2 flex items-end">
            <p className="text-xs text-ink-faint">Clear pricing builds trust. You can edit pricing later in dashboard → vehicle → edit.</p>
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="card p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-bold"><MapPin className="h-4 w-4 text-brand-600" /> Location</h2>
        <p className="text-xs text-ink-mute">Where customers pick up the vehicle. Defaults to your provider base location if blank.</p>
        <div className="mt-4">
          <LocationPicker value={loc?.label} onPick={setLoc} />
          {loc?.lat && loc?.lng && <p className="mt-2 text-xs text-ink-mute">{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</p>}
        </div>
      </section>

      {/* Photos */}
      <section className="card p-5 sm:p-6">
        <h2 className="font-bold">Photos</h2>
        <p className="text-xs text-ink-mute">Upload up to 10 photos. First photo is cover.</p>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleUpload(f); e.target.value = ""; } }} />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((url, idx) => (
            <div key={idx} className="relative overflow-hidden rounded-2xl border border-ink/10">
              <img src={url} alt={`Vehicle ${idx + 1}`} className="h-36 w-full object-cover" />
              <button type="button" onClick={() => setImages(images.filter((_, i) => i !== idx))} className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white hover:bg-red-600"><X className="h-4 w-4" /></button>
              {idx === 0 && <span className="absolute bottom-1.5 left-1.5 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">Cover</span>}
            </div>
          ))}
          {images.length < 10 && (
            <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleUpload(f); }} className="flex min-h-[144px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/15 bg-paper p-4 text-sm text-ink-mute hover:border-brand-400 hover:bg-brand-50">
              {uploading ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" /> : <><Upload className="h-6 w-6" /><span className="font-medium">Upload photo</span><span className="text-xs">JPEG/PNG/WebP • 5 MB</span></>}
            </button>
          )}
        </div>
        {images.length > 0 && <p className="mt-2 flex items-center gap-1 text-xs text-emerald-700"><ImageIcon className="h-3.5 w-3.5" /> {images.length} photo(s) attached</p>}
      </section>

      {err && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">{err}</p>}

      <button type="submit" disabled={busy || uploading} className="btn-primary h-12 w-full text-base font-bold">
        {busy ? "Saving…" : mode === "edit" ? "Save Changes" : "Register Vehicle"}
      </button>
      <p className="text-center text-xs text-ink-faint">{mode === "edit" ? "Changes are visible to customers immediately if vehicle is ACTIVE." : "Vehicle will appear in My Vehicles and become searchable once ACTIVE."}</p>
    </form>
  );
}
