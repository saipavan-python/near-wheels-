"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/ui";
import LocationPicker from "./LocationPicker";
import { getVehicleConfig, VEHICLE_CATEGORIES, type VehicleCategory } from "@/lib/vehicleConfig";
import { BadgeCheck, Upload, X, ImageIcon, AlertTriangle, Check, CarFront, Bus, MapPin } from "lucide-react";

const GARAGE_SERVICES = ["MECHANIC", "TOWING", "BATTERY", "TYRE", "ELECTRICAL", "AC_REPAIR", "WATER_SERVICE", "BREAKDOWN"];
const EQUIPMENT = ["TRACTOR", "TRACTOR_TRAILER", "CULTIVATOR", "ROTAVATOR", "HARVESTER", "WATER_TANKER", "FARM_TRANSPORT", "AGRI_MACHINE"];

export default function RegisterForm({ providerType }: { providerType: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loc, setLoc] = useState<{ label: string; lat?: number; lng?: number } | null>(null);
  const [radius, setRadius] = useState(15);
  const [autoAccept, setAutoAccept] = useState(true);

  // vehicle owner - type-driven state
  const [vCategory, setVCategory] = useState<VehicleCategory>("CAR");
  const [vMake, setVMake] = useState("");
  const [vModel, setVModel] = useState("");
  const [vYear, setVYear] = useState<number | "">("");
  const [vFuelType, setVFuelType] = useState("PETROL");
  const [vTransmission, setVTransmission] = useState("MANUAL");
  const [vSeats, setVSeats] = useState(5);
  const [vColor, setVColor] = useState("");
  const [vLoadTons, setVLoadTons] = useState<number | "">("");
  const [vEngineCC, setVEngineCC] = useState<number | "">("");
  const [vMileage, setVMileage] = useState("");
  const [vAc, setVAc] = useState(true);
  const [vSelf, setVSelf] = useState(false);
  const [vFeatures, setVFeatures] = useState<string[]>([]);
  const [vImage, setVImage] = useState<string | null>(null);
  const [vUploading, setVUploading] = useState(false);
  const [vError, setVError] = useState<string | null>(null);
  const vehicleInputRef = useRef<HTMLInputElement>(null);

  // centralized config for current category
  const vConfig = getVehicleConfig(vCategory);

  // driver
  const [dYears, setDYears] = useState(3);
  const [dLicense, setDLicense] = useState("LMV");
  const [dLicenseImage, setDLicenseImage] = useState<string | null>(null);
  const [dLicenseUploading, setDLicenseUploading] = useState(false);
  const [dLicenseError, setDLicenseError] = useState<string | null>(null);
  const licenseInputRef = useRef<HTMLInputElement>(null);

  // garage
  const [gServices, setGServices] = useState<string[]>(["MECHANIC"]);
  const [g24x7, setG24x7] = useState(true);

  // farm
  const [fType, setFType] = useState("TRACTOR");
  const [fTitle, setFTitle] = useState("");

  // drone
  const [drDrones, setDrDrones] = useState(1);
  const [drAcresDay, setDrAcresDay] = useState(20);
  const [drCert, setDrCert] = useState("");

  // yatra bus (temple yatra) - extends BUS with package
  const [yPackageName, setYPackageName] = useState("Tirupati Balaji Darshan Yatra");
  const [yDescription, setYDescription] = useState("2-day temple yatra with comfortable bus, experienced driver and guided temple visits. Includes Tirupati Balaji, Padmavathi and Srikalahasti.");
  const [yPricePerHead, setYPricePerHead] = useState<number | ""> (1200);
  const [yTotalSeats, setYTotalSeats] = useState(32);
  const [yDepartureDate, setYDepartureDate] = useState(() => new Date(Date.now() + 7*24*3600*1000).toISOString().slice(0,10));
  const [yReturnDate, setYReturnDate] = useState("");
  const [yStops, setYStops] = useState<string[]>(["Tirupati Balaji Temple", "Padmavathi Temple", "Srikalahasti Temple"]);
  const [yNewStop, setYNewStop] = useState("");

  // starter pricing
  const [priceModel, setPriceModel] = useState(
    providerType === "GARAGE" ? "PER_VISIT" : providerType === "FARM" || providerType === "DRONE" ? "PER_ACRE" : providerType === "DRIVER" ? "DAILY" : providerType === "YATRA" ? "PER_KM" : "DAILY"
  );
  const [dailyRate, setDailyRate] = useState<number | "">("");
  const [hourlyRate, setHourlyRate] = useState<number | "">("");
  const [perKm, setPerKm] = useState<number | "">("");
  const [perAcre, setPerAcre] = useState<number | "">("");
  const [visitCharge, setVisitCharge] = useState<number | "">("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // lock Yatra Bus to BUS category
  useEffect(() => {
    if (providerType === "YATRA" && vCategory !== "BUS") setVCategory("BUS");
  }, [providerType]);

  // CRITICAL: when vehicle category changes, reset stale Car values and apply defaults for new type
  useEffect(() => {
    if (providerType !== "VEHICLE_OWNER" && providerType !== "YATRA") return;
    const cfg = getVehicleConfig(vCategory);
    setVMake("");
    setVModel("");
    setVYear("");
    setVColor("");
    setVLoadTons("");
    setVEngineCC("");
    setVMileage("");
    setVFeatures([]);
    setVImage(null);
    setVError(null);
    setVAc(cfg.showAc ? true : false);
    setVSelf(cfg.defaults.selfDrive);
    setVSeats(cfg.defaults.seats);
    setVFuelType(cfg.defaults.fuelType);
    setVTransmission(cfg.defaults.transmission);
    // reset pricing to first allowed model for new category
    if (cfg.pricingModels.length && !cfg.pricingModels.includes(priceModel)) {
      setPriceModel(cfg.pricingModels[0]);
      setDailyRate("");
      setHourlyRate("");
      setPerKm("");
      setPerAcre("");
      setVisitCharge("");
    }
    setFieldErrors({});
  }, [vCategory]);

  function toggleService(s: string) {
    setGServices((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  }
  function toggleVFeature(key: string) {
    setVFeatures((cur) => (cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key]));
  }

  async function handleVehicleUpload(file: File) {
    setVError(null);
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowed.includes(file.type)) {
      setVError("Only JPEG, PNG or WebP images are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setVError("File size must be under 5 MB.");
      return;
    }
    setVUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setVError(data.error || "Upload failed. Please try again.");
      } else {
        setVImage(data.url);
      }
    } catch {
      setVError("Network error — please try again.");
    } finally {
      setVUploading(false);
    }
  }

  async function handleLicenseUpload(file: File) {
    setDLicenseError(null);
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowed.includes(file.type)) {
      setDLicenseError("Only JPEG, PNG or WebP images are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setDLicenseError("File size must be under 5 MB.");
      return;
    }
    setDLicenseUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setDLicenseError(data.error || "Upload failed. Please try again.");
      } else {
        setDLicenseImage(data.url);
      }
    } catch {
      setDLicenseError("Network error — please try again.");
    } finally {
      setDLicenseUploading(false);
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Business name is required";
    if (phone.length !== 10) errs.phone = "Enter 10-digit mobile number";
    if (!loc) errs.loc = "Base location is required";
    if (providerType === "VEHICLE_OWNER" || providerType === "YATRA") {
      const cfg = getVehicleConfig(vCategory);
      for (const f of cfg.fields) {
        if (f.required) {
          const val = f.key === "make" ? vMake : f.key === "model" ? vModel : f.key === "seats" ? String(vSeats) : f.key === "loadCapacityTons" ? String(vLoadTons) : "";
          if (!String(val).trim() || val === "") errs[f.key] = `${f.label} is required`;
        }
      }
      if (!vMake.trim()) errs.make = "Brand is required";
      if (!vModel.trim()) errs.model = "Model is required";
      if (vSeats < 1) errs.seats = "Seats must be at least 1";
      if (providerType === "YATRA") {
        if (!yPackageName.trim()) errs.yPackageName = "Package name is required";
        if (yDescription.trim().length < 20) errs.yDescription = "Description must be at least 20 characters";
        if (yPricePerHead === "" || Number(yPricePerHead) <= 0) errs.yPricePerHead = "Price per head is required";
        if (yTotalSeats < 1) errs.yTotalSeats = "Total seats is required";
        if (!yDepartureDate) errs.yDepartureDate = "Departure date is required";
        if (yStops.length < 1) errs.yStops = "At least one temple stop is required";
      }
    }
    if (providerType === "FARM" && !fTitle.trim()) errs.fTitle = "Equipment title is required";
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      setErr("Please fix the highlighted fields.");
      return false;
    }
    return true;
  }

  async function submit() {
    setErr(null);
    if (!validate()) return;
    const body: Record<string, unknown> = {
      type: providerType,
      businessName: name.trim(),
      phone,
      locationText: loc!.label,
      lat: loc!.lat,
      lng: loc!.lng,
      serviceRadiusKm: radius,
      autoAccept,
    };

    switch (providerType) {
      case "VEHICLE_OWNER":
      case "YATRA": {
        const cfg = getVehicleConfig(providerType === "YATRA" ? "BUS" : vCategory);
        const cat = providerType === "YATRA" ? "BUS" : vCategory;
        // Build payload with only relevant fields for this category — no stale car values for auto
        const vehicle: Record<string, unknown> = {
          category: cat,
          make: vMake.trim(),
          model: vModel.trim(),
          seats: vSeats,
          selfDriveAllowed: providerType === "YATRA" ? false : cfg.showSelfDrive ? vSelf : false,
          withDriverAllowed: true,
          imageUrl: vImage || undefined,
          // type-specific optional fields
          ...(vYear !== "" ? { year: Number(vYear) } : {}),
          ...(vColor.trim() ? { color: vColor.trim() } : {}),
          ...(vFuelType ? { fuelType: vFuelType } : {}),
          ...(cfg.fields.some((f) => f.key === "transmission") && vTransmission ? { transmission: vTransmission } : {}),
          ...(vLoadTons !== "" && cfg.fields.some((f) => f.key === "loadCapacityTons") ? { loadCapacityTons: Number(vLoadTons) } : {}),
          ...(vAc !== undefined && cfg.showAc ? { ac: vAc } : {}),
          // store selected features as JSON in docsJson via extra field (backend ignores unknown but we keep for preview)
          ...(vFeatures.length ? { features: vFeatures } : {}),
          // bike/scooter specific
          ...(vEngineCC !== "" ? { engineCC: Number(vEngineCC) } : {}),
          ...(vMileage ? { mileage: vMileage } : {}),
        };
        body.vehicle = vehicle;
        if (providerType === "YATRA") {
          body.yatra = {
            packageName: yPackageName.trim(),
            description: yDescription.trim(),
            pricePerHead: Number(yPricePerHead),
            totalSeats: Number(yTotalSeats),
            departureDate: yDepartureDate,
            returnDate: yReturnDate || undefined,
            stops: yStops.map((name) => ({ name })),
            category: "TEMPLE_YATRA",
          };
          // Yatra Bus pricing is per head — use PER_KM as placeholder but backend will use yatra package pricing
          // Keep vehicle pricing as PER_KM for bus
        }
        break;
      }
      case "DRIVER":
        body.profile = { experienceYears: dYears, licenseType: dLicense, licenseImageUrl: dLicenseImage || undefined };
        break;
      case "GARAGE":
        body.profile = { services: gServices.length ? gServices : ["MECHANIC"], open24x7: g24x7 };
        break;
      case "FARM":
        body.equipment = {
          equipmentType: fType,
          title: fTitle.trim() || fType.replaceAll("_", " "),
        };
        break;
      case "DRONE":
        body.profile = {
          dronesCount: drDrones,
          acresPerDay: drAcresDay,
          certificateNo: drCert.trim() || undefined,
        };
        break;
    }

    body.pricing = {
      model: priceModel,
      ...(dailyRate !== "" ? { dailyRate } : {}),
      ...(hourlyRate !== "" ? { hourlyRate } : {}),
      ...(perKm !== "" ? { perKm } : {}),
      ...(perAcre !== "" ? { perAcre, minAcres: 2 } : {}),
      ...(visitCharge !== "" ? { visitCharge } : {}),
    };

    setBusy(true);
    const r = await api("/api/providers/register", { json: body });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error || "Registration failed. Please check the details.");
    setDone(true);
  }

  if (done) {
    return (
      <div className="card p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><BadgeCheck className="h-7 w-7" /></span>
        <h2 className="mt-3 text-lg font-bold">Registration received!</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-mute">
          Our team verifies providers within 1–2 days. You&apos;ll be visible to nearby customers
          as soon as verification completes.
        </p>
        <a href="/" className="btn-primary mt-5 !py-2.5">Back to home</a>
      </div>
    );
  }

  return (
    <div className="card space-y-5 p-5 sm:p-6">
      <div>
        <label className="label" htmlFor="reg-name">Your name / business name *</label>
        <input id="reg-name" className="input h-12 text-base" value={name} onChange={(e) => setName(e.target.value)} placeholder={providerType === "DRIVER" ? "e.g. Ravi Kumar" : "e.g. Sri Sai Travels"} aria-invalid={!!fieldErrors.name} />
        {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
      </div>

      <div>
        <label className="label" htmlFor="reg-phone">Mobile number *</label>
        <div className="flex gap-2">
          <span className="grid h-12 place-items-center rounded-xl border border-ink/15 bg-paper px-3 text-sm font-semibold text-ink-mute">+91</span>
          <input id="reg-phone" className="input h-12 flex-1 text-base" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit number" aria-invalid={!!fieldErrors.phone} />
        </div>
        {fieldErrors.phone && <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>}
      </div>

      <div>
        <span className="label">Base location (customers search near this) *</span>
        <LocationPicker value={loc?.label} onPick={setLoc} />
        {fieldErrors.loc && <p className="mt-1 text-xs text-red-600">{fieldErrors.loc}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="reg-radius">Service radius (km)</label>
          <input id="reg-radius" type="number" min={1} max={100} className="input h-12" value={radius} onChange={(e) => setRadius(Math.max(1, Number(e.target.value) || 1))} />
        </div>
        <div>
          <span className="label">Instant accept</span>
          <button
            type="button"
            aria-pressed={autoAccept}
            onClick={() => setAutoAccept((v) => !v)}
            className={`flex h-12 w-full items-center justify-center rounded-xl border px-3 text-sm font-semibold transition ${autoAccept ? "border-brand-600 bg-brand-50 text-brand-800" : "border-ink/15 text-ink-mute hover:border-brand-400"}`}
          >
            {autoAccept ? "On — auto-accept" : "Off — review each"}
          </button>
        </div>
      </div>

      {/* type-specific sections */}
      {providerType === "VEHICLE_OWNER" && (
        <motion.div
          key={vCategory}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5 rounded-2xl border border-ink/10 bg-paper p-4 sm:p-5"
        >
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-ink text-white"><CarFront className="h-4 w-4" /></span>
            <div>
              <h3 className="text-sm font-bold">Vehicle details</h3>
              <p className="text-xs text-ink-mute">{vConfig.description}</p>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="reg-vcat">Vehicle category *</label>
            <select id="reg-vcat" className="input h-12 text-base" value={vCategory} onChange={(e) => setVCategory(e.target.value as VehicleCategory)}>
              {VEHICLE_CATEGORIES.map((c) => {
                const cfg = getVehicleConfig(c);
                return <option key={c} value={c}>{cfg.label} — {c}</option>;
              })}
            </select>
            <p className="mt-1 text-xs text-ink-faint">Switching category clears previous category’s fields.</p>
          </div>

          {/* Dynamic fields per category */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {vConfig.fields.map((f) => (
              <div key={f.key} className={f.key === "make" || f.key === "model" ? "" : ""}>
                <label className="label" htmlFor={`reg-v-${f.key}`}>{f.label}{f.required ? " *" : ""}</label>
                {f.type === "select" ? (
                  <select
                    id={`reg-v-${f.key}`}
                    className="input h-12"
                    value={f.key === "fuelType" ? vFuelType : f.key === "transmission" ? vTransmission : ""}
                    onChange={(e) => {
                      if (f.key === "fuelType") setVFuelType(e.target.value);
                      if (f.key === "transmission") setVTransmission(e.target.value);
                    }}
                  >
                    {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.key === "seats" ? (
                  <>
                    <input id={`reg-v-${f.key}`} type="number" min={f.min} max={f.max} className="input h-12" value={vSeats} onChange={(e) => setVSeats(Math.max(1, Number(e.target.value) || 1))} />
                    <p className="mt-1 text-xs text-ink-faint">{vConfig.label} seats: {f.min}–{f.max}</p>
                  </>
                ) : f.key === "loadCapacityTons" ? (
                  <input id={`reg-v-${f.key}`} type="number" step="0.5" min={f.min} max={f.max} className="input h-12" value={vLoadTons} onChange={(e) => setVLoadTons(e.target.value ? Number(e.target.value) : "")} placeholder={f.placeholder} />
                ) : f.key === "engineCC" ? (
                  <input id={`reg-v-${f.key}`} type="number" min={f.min} max={f.max} className="input h-12" value={vEngineCC} onChange={(e) => setVEngineCC(e.target.value ? Number(e.target.value) : "")} placeholder={f.placeholder} />
                ) : f.key === "mileage" ? (
                  <input id={`reg-v-${f.key}`} type="text" className="input h-12" value={vMileage} onChange={(e) => setVMileage(e.target.value)} placeholder={f.placeholder} />
                ) : (
                  <input
                    id={`reg-v-${f.key}`}
                    className="input h-12"
                    value={
                      f.key === "make" ? vMake :
                      f.key === "model" ? vModel :
                      f.key === "year" ? String(vYear) :
                      f.key === "color" ? vColor : ""
                    }
                    onChange={(e) => {
                      if (f.key === "make") setVMake(e.target.value);
                      else if (f.key === "model") setVModel(e.target.value);
                      else if (f.key === "year") setVYear(e.target.value ? Number(e.target.value) : "");
                      else if (f.key === "color") setVColor(e.target.value);
                    }}
                    placeholder={f.placeholder}
                    aria-invalid={!!fieldErrors[f.key]}
                  />
                )}
                {fieldErrors[f.key] && <p className="mt-1 text-xs text-red-600">{fieldErrors[f.key]}</p>}
              </div>
            ))}
          </div>

          {/* Category-specific toggles */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {vConfig.showAc && (
              <label className="flex h-12 items-center gap-3 rounded-xl border border-ink/15 bg-white px-3">
                <input type="checkbox" checked={vAc} onChange={(e) => setVAc(e.target.checked)} className="h-5 w-5 rounded border-ink/20 accent-brand-600" />
                <span className="text-sm font-medium">AC available</span>
              </label>
            )}
            {vConfig.showSelfDrive && (
              <button
                type="button"
                aria-pressed={vSelf}
                onClick={() => setVSelf((v) => !v)}
                className={`flex h-12 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition ${vSelf ? "border-brand-600 bg-brand-50 text-brand-800" : "border-ink/15 text-ink-mute hover:border-brand-400"}`}
              >
                {vSelf ? "Self-drive allowed" : "With driver only"}
              </button>
            )}
          </div>

          {/* Features per category */}
          {vConfig.features.length > 0 && (
            <div>
              <span className="label">Features for {vConfig.label}</span>
              <div className="flex flex-wrap gap-2">
                {vConfig.features.map((feat) => (
                  <button
                    key={feat.key}
                    type="button"
                    aria-pressed={vFeatures.includes(feat.key)}
                    onClick={() => toggleVFeature(feat.key)}
                    className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${vFeatures.includes(feat.key) ? "border-brand-600 bg-brand-600 text-white shadow-sm" : "border-ink/15 bg-white text-ink-mute hover:border-brand-400 hover:text-brand-700"}`}
                  >
                    {vFeatures.includes(feat.key) && <Check className="mr-1 inline h-3.5 w-3.5" />} {feat.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-ink-faint">Only {vConfig.label} features are shown. Switching category clears these.</p>
            </div>
          )}

          {/* Preview for this category */}
          <div className="rounded-xl border border-brand-100 bg-brand-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Preview — {vConfig.label}</p>
            <p className="mt-1 text-sm text-ink-mute">
              <span className="font-semibold text-ink">{vMake || "Brand"} {vModel || "Model"}</span> • {vCategory} • {vSeats} seats
              {vFuelType ? ` • ${vFuelType}` : ""} {vColor ? ` • ${vColor}` : ""}
              {vLoadTons !== "" ? ` • ${vLoadTons} tons` : ""} {vAc && vConfig.showAc ? " • AC" : ""} {vSelf && vConfig.showSelfDrive ? " • Self-drive" : " • With driver"}
            </p>
            {vFeatures.length > 0 && <p className="mt-1 text-xs text-ink-mute">Features: {vFeatures.join(", ") || "None"}</p>}
            {vImage && <p className="mt-1 text-xs font-medium text-emerald-700">✓ Photo attached</p>}
          </div>

          {/* Vehicle image upload */}
          <div>
            <span className="label">Upload vehicle photo *</span>
            <input
              ref={vehicleInputRef}
              id="reg-vimage-img"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleVehicleUpload(f);
                e.target.value = "";
              }}
            />

            {!vImage ? (
              <button
                type="button"
                disabled={vUploading}
                onClick={() => vehicleInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleVehicleUpload(f);
                }}
                className="flex min-h-[96px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/15 bg-paper px-4 py-6 text-sm text-ink-mute transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600"
              >
                {vUploading ? (
                  <>
                    <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                    <span>Uploading…</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-ink-faint" />
                    <span className="font-medium">Click or drag photo</span>
                    <span className="text-xs text-ink-faint">JPEG, PNG or WebP — max 5 MB • For {vConfig.label} only</span>
                  </>
                )}
              </button>
            ) : (
              <div className="relative overflow-hidden rounded-2xl border border-ink/15">
                <img
                  src={vImage}
                  alt={`${vConfig.label} photo`}
                  className="h-48 w-full object-cover bg-paper"
                />
                <button
                  type="button"
                  onClick={() => setVImage(null)}
                  className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-red-600"
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-2 border-t border-ink/10 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                  <ImageIcon className="h-4 w-4" />
                  {vConfig.label} photo uploaded
                </div>
              </div>
            )}

            {vError && (
              <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">{vError}</p>
            )}
          </div>
        </motion.div>
      )}

      {providerType === "YATRA" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5"
        >
          <div className="space-y-5 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-amber-600 text-white"><Bus className="h-4 w-4" /></span>
              <div>
                <h3 className="text-sm font-bold">Yatra Bus — Vehicle (BUS)</h3>
                <p className="text-xs text-ink-mute">Bus details are fixed to 20–60 seater AC buses for temple yatra.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="reg-y-make">Bus Make *</label>
                <input id="reg-y-make" className="input h-12" value={vMake} onChange={(e) => setVMake(e.target.value)} placeholder="Eicher, Tata" />
                {fieldErrors.make && <p className="mt-1 text-xs text-red-600">{fieldErrors.make}</p>}
              </div>
              <div>
                <label className="label" htmlFor="reg-y-model">Bus Model *</label>
                <input id="reg-y-model" className="input h-12" value={vModel} onChange={(e) => setVModel(e.target.value)} placeholder="Starline 32" />
                {fieldErrors.model && <p className="mt-1 text-xs text-red-600">{fieldErrors.model}</p>}
              </div>
              <div>
                <label className="label" htmlFor="reg-y-seats">Seats *</label>
                <input id="reg-y-seats" type="number" min={12} max={60} className="input h-12" value={vSeats} onChange={(e) => setVSeats(Number(e.target.value) || 32)} />
              </div>
              <div>
                <label className="label" htmlFor="reg-y-year">Year</label>
                <input id="reg-y-year" type="number" className="input h-12" value={vYear} onChange={(e) => setVYear(e.target.value ? Number(e.target.value) : "")} placeholder="2020" />
              </div>
              <div>
                <label className="label" htmlFor="reg-y-fuel">Fuel</label>
                <select id="reg-y-fuel" className="input h-12" value={vFuelType} onChange={(e) => setVFuelType(e.target.value)}>
                  <option value="DIESEL">DIESEL</option><option value="CNG">CNG</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="reg-y-color">Color</label>
                <input id="reg-y-color" className="input h-12" value={vColor} onChange={(e) => setVColor(e.target.value)} placeholder="White" />
              </div>
            </div>
            <div>
              <span className="label">Upload bus photo *</span>
              <input
                ref={vehicleInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleVehicleUpload(f);
                  e.target.value = "";
                }}
              />
              {!vImage ? (
                <button
                  type="button"
                  disabled={vUploading}
                  onClick={() => vehicleInputRef.current?.click()}
                  className="flex min-h-[96px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/15 bg-white px-4 py-6 text-sm text-ink-mute transition hover:border-brand-400 hover:bg-brand-50"
                >
                  {vUploading ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" /> : <><Upload className="h-8 w-8 text-ink-faint" /><span className="font-medium">Click or drag bus photo</span><span className="text-xs text-ink-faint">JPEG, PNG, WebP — max 5 MB</span></>}
                </button>
              ) : (
                <div className="relative overflow-hidden rounded-2xl border border-ink/15">
                  <img src={vImage} alt="Bus" className="h-48 w-full object-cover bg-white" />
                  <button type="button" onClick={() => setVImage(null)} className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white"><X className="h-4 w-4" /></button>
                  <div className="flex items-center gap-2 border-t bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"><ImageIcon className="h-4 w-4" />Bus photo uploaded</div>
                </div>
              )}
              {vError && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{vError}</p>}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-brand-200 bg-white p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-600 text-white"><MapPin className="h-4 w-4" /></span>
              <div>
                <h3 className="text-sm font-bold">Yatra package details</h3>
                <p className="text-xs text-ink-mute">This package will be listed on Yatra Buses after verification.</p>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="reg-y-pkg">Package name *</label>
              <input id="reg-y-pkg" className="input h-12" value={yPackageName} onChange={(e) => setYPackageName(e.target.value)} placeholder="Tirupati Balaji Darshan Yatra" />
              {fieldErrors.yPackageName && <p className="mt-1 text-xs text-red-600">{fieldErrors.yPackageName}</p>}
            </div>
            <div>
              <label className="label" htmlFor="reg-y-desc">Description *</label>
              <textarea id="reg-y-desc" className="input min-h-[96px] py-3" value={yDescription} onChange={(e) => setYDescription(e.target.value)} placeholder="2-day temple yatra with bus, driver and guided visits..." rows={3} />
              {fieldErrors.yDescription && <p className="mt-1 text-xs text-red-600">{fieldErrors.yDescription}</p>}
              <p className="mt-1 text-xs text-ink-faint">{yDescription.length}/2000</p>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="reg-y-price">Price per head (₹) *</label>
                <input id="reg-y-price" type="number" min={1} className="input h-12" value={yPricePerHead} onChange={(e) => setYPricePerHead(e.target.value ? Number(e.target.value) : "")} placeholder="1200" />
                {fieldErrors.yPricePerHead && <p className="mt-1 text-xs text-red-600">{fieldErrors.yPricePerHead}</p>}
              </div>
              <div>
                <label className="label" htmlFor="reg-y-seats-total">Total seats *</label>
                <input id="reg-y-seats-total" type="number" min={1} max={60} className="input h-12" value={yTotalSeats} onChange={(e) => setYTotalSeats(Number(e.target.value) || 32)} />
                {fieldErrors.yTotalSeats && <p className="mt-1 text-xs text-red-600">{fieldErrors.yTotalSeats}</p>}
              </div>
              <div>
                <label className="label" htmlFor="reg-y-dep">Departure *</label>
                <input id="reg-y-dep" type="date" className="input h-12" value={yDepartureDate} onChange={(e) => setYDepartureDate(e.target.value)} />
                {fieldErrors.yDepartureDate && <p className="mt-1 text-xs text-red-600">{fieldErrors.yDepartureDate}</p>}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="reg-y-ret">Return date (optional)</label>
              <input id="reg-y-ret" type="date" className="input h-12" value={yReturnDate} onChange={(e) => setYReturnDate(e.target.value)} />
            </div>
            <div>
              <span className="label">Temple stops (max 20) *</span>
              <div className="rounded-xl border border-ink/15 bg-paper p-3">
                <div className="flex flex-wrap gap-2">
                  {yStops.map((s, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium shadow-sm ring-1 ring-ink/10">
                      #{i + 1} {s} <button type="button" onClick={() => setYStops(yStops.filter((_, idx) => idx !== i))} className="ml-1 text-ink-faint hover:text-red-600"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input className="input h-12 flex-1" value={yNewStop} onChange={(e) => setYNewStop(e.target.value)} placeholder="Add temple e.g. Kanipakam" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (yNewStop.trim() && yStops.length < 20) { setYStops([...yStops, yNewStop.trim()]); setYNewStop(""); } } }} />
                  <button type="button" disabled={!yNewStop.trim() || yStops.length >= 20} onClick={() => { if (yNewStop.trim()) { setYStops([...yStops, yNewStop.trim()]); setYNewStop(""); } }} className="btn-outline h-12 shrink-0 !px-4">+ Add</button>
                </div>
                {fieldErrors.yStops && <p className="mt-2 text-xs text-red-600">{fieldErrors.yStops}</p>}
                <p className="mt-2 text-xs text-ink-faint">{yStops.length}/20 stops • At least one required</p>
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Yatra package will be created together with your BUS — no separate step needed. Verification in 1–2 days.</div>
          </div>
        </motion.div>
      )}

      {providerType === "DRIVER" && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="reg-dyears">Experience (years) *</label>
              <input id="reg-dyears" type="number" min={0} max={50} className="input h-12" value={dYears} onChange={(e) => setDYears(Number(e.target.value) || 0)} />
            </div>
            <div>
              <label className="label" htmlFor="reg-dlic">Licence type *</label>
              <select id="reg-dlic" className="input h-12" value={dLicense} onChange={(e) => setDLicense(e.target.value)}>
                {["LMV", "LMV_TR", "HMV", "HPMV", "AUTO_RICKSHAW"].map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div>
            <span className="label">Upload your licence image *</span>
            <input
              ref={licenseInputRef}
              id="reg-dlicense-img"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleLicenseUpload(f);
                e.target.value = "";
              }}
            />

            {!dLicenseImage ? (
              <button
                type="button"
                disabled={dLicenseUploading}
                onClick={() => licenseInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleLicenseUpload(f);
                }}
                className="flex min-h-[96px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/15 bg-paper px-4 py-6 text-sm text-ink-mute transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600"
              >
                {dLicenseUploading ? (
                  <>
                    <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                    <span>Uploading…</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-ink-faint" />
                    <span className="font-medium">Click or drag licence photo</span>
                    <span className="text-xs text-ink-faint">JPEG, PNG or WebP — max 5 MB</span>
                  </>
                )}
              </button>
            ) : (
              <div className="relative overflow-hidden rounded-2xl border border-ink/15">
                <img
                  src={dLicenseImage}
                  alt="Licence"
                  className="h-48 w-full object-contain bg-paper"
                />
                <button
                  type="button"
                  onClick={() => setDLicenseImage(null)}
                  className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-red-600"
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-2 border-t border-ink/10 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
                  <ImageIcon className="h-4 w-4" />
                  Licence uploaded
                </div>
              </div>
            )}

            {dLicenseError && (
              <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">{dLicenseError}</p>
            )}
          </div>
        </>
      )}

      {providerType === "GARAGE" && (
        <>
          <div>
            <span className="label">Services offered *</span>
            <div className="flex flex-wrap gap-2">
              {GARAGE_SERVICES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={gServices.includes(s)}
                  onClick={() => toggleService(s)}
                  className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition ${gServices.includes(s) ? "border-brand-600 bg-brand-600 text-white shadow-sm" : "border-ink/15 bg-white text-ink-mute hover:border-brand-400 hover:text-brand-700"}`}
                >
                  {s.replaceAll("_", " ")}
                </button>
              ))}
            </div>
          </div>
          <label className="flex h-12 items-center gap-3 rounded-xl border border-ink/15 bg-white px-3">
            <input type="checkbox" checked={g24x7} onChange={(e) => setG24x7(e.target.checked)} className="h-5 w-5 rounded border-ink/20 accent-brand-600" />
            <span className="text-sm font-medium">Open 24×7 for breakdowns</span>
          </label>
        </>
      )}

      {providerType === "FARM" && (
        <>
          <div>
            <label className="label" htmlFor="reg-ftype">Equipment type *</label>
            <select id="reg-ftype" className="input h-12" value={fType} onChange={(e) => setFType(e.target.value)}>
              {EQUIPMENT.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="reg-ftitle">Equipment title *</label>
            <input id="reg-ftitle" className="input h-12" value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="John Deere 5310 with rotavator" aria-invalid={!!fieldErrors.fTitle} />
            {fieldErrors.fTitle && <p className="mt-1 text-xs text-red-600">{fieldErrors.fTitle}</p>}
          </div>
        </>
      )}

      {providerType === "DRONE" && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label" htmlFor="reg-drn">Drones *</label>
            <input id="reg-drn" type="number" min={1} max={20} className="input h-12" value={drDrones} onChange={(e) => setDrDrones(Number(e.target.value) || 1)} />
          </div>
          <div>
            <label className="label" htmlFor="reg-dra">Acres/day *</label>
            <input id="reg-dra" type="number" min={1} className="input h-12" value={drAcresDay} onChange={(e) => setDrAcresDay(Number(e.target.value) || 10)} />
          </div>
          <div>
            <label className="label" htmlFor="reg-drc">Certificate no.</label>
            <input id="reg-drc" className="input h-12" value={drCert} onChange={(e) => setDrCert(e.target.value)} placeholder="DGCA…" />
          </div>
        </div>
      )}

      {/* starter pricing — type-aware */}
      <fieldset className="rounded-2xl border border-ink/15 bg-paper p-4">
        <legend className="px-1 text-sm font-bold text-ink">Starting price</legend>
        <p className="mb-3 text-xs text-ink-faint">You can fine-tune detailed rules in the dashboard later.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="reg-pmodel">Pricing model *</label>
            <select id="reg-pmodel" className="input h-12" value={priceModel} onChange={(e) => { setPriceModel(e.target.value); setDailyRate(""); setHourlyRate(""); setPerKm(""); setPerAcre(""); setVisitCharge(""); }}>
              {priceModelsFor(providerType, vCategory).map((m) => (
                <option key={m.v} value={m.v}>{m.l}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-faint">
              {providerType === "VEHICLE_OWNER" ? `For ${vConfig.label}: ${vConfig.pricingModels.join(", ")}` : ""}
            </p>
          </div>
          {(priceModel === "DAILY") && (
            <div>
              <label className="label" htmlFor="reg-pr">₹ per day *</label>
              <input id="reg-pr" type="number" min={0} className="input h-12" value={dailyRate} onChange={(e) => setDailyRate(e.target.value ? Number(e.target.value) : "")} placeholder="e.g. 1700" />
            </div>
          )}
          {(priceModel === "HOURLY") && (
            <div>
              <label className="label" htmlFor="reg-ph">₹ per hour *</label>
              <input id="reg-ph" type="number" min={0} className="input h-12" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value ? Number(e.target.value) : "")} placeholder="e.g. 120" />
            </div>
          )}
          {(priceModel === "PER_KM") && (
            <div>
              <label className="label" htmlFor="reg-pk">₹ per km *</label>
              <input id="reg-pk" type="number" step="0.5" min={0} className="input h-12" value={perKm} onChange={(e) => setPerKm(e.target.value ? Number(e.target.value) : "")} placeholder="e.g. 14" />
            </div>
          )}
          {(priceModel === "PER_ACRE") && (
            <div>
              <label className="label" htmlFor="reg-pa">₹ per acre *</label>
              <input id="reg-pa" type="number" min={0} className="input h-12" value={perAcre} onChange={(e) => setPerAcre(e.target.value ? Number(e.target.value) : "")} placeholder="e.g. 800" />
            </div>
          )}
          {(priceModel === "PER_VISIT") && (
            <div>
              <label className="label" htmlFor="reg-pv">₹ visit charge *</label>
              <input id="reg-pv" type="number" min={0} className="input h-12" value={visitCharge} onChange={(e) => setVisitCharge(e.target.value ? Number(e.target.value) : "")} placeholder="e.g. 300" />
            </div>
          )}
        </div>
      </fieldset>

      {err && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600" role="alert">{err}</p>}

      <button className="btn-primary h-12 w-full text-base font-bold" disabled={busy} onClick={submit}>
        {busy ? "Submitting…" : "Submit registration"}
      </button>
      <p className="text-center text-xs text-ink-faint">Step 4 of 4 · Review your {providerType === "VEHICLE_OWNER" ? vConfig.label : providerType} details above before submitting</p>
    </div>
  );
}

function priceModelsFor(t: string, vCat?: string): { v: string; l: string }[] {
  if (t === "GARAGE") {
    return [
      { v: "PER_VISIT", l: "₹ per visit" },
      { v: "PER_KM", l: "₹ per km (towing)" },
    ];
  }
  if (t === "FARM" || t === "DRONE") {
    return [{ v: "PER_ACRE", l: "₹ per acre" }, { v: "DAILY", l: "₹ per day" }];
  }
  if ((t === "VEHICLE_OWNER" || t === "YATRA") && vCat) {
    const cfg = getVehicleConfig(vCat);
    return cfg.pricingModels.map((m) => {
      if (m === "DAILY") return { v: "DAILY", l: "₹ per day" };
      if (m === "PER_KM") return { v: "PER_KM", l: "₹ per km" };
      if (m === "HOURLY") return { v: "HOURLY", l: "₹ per hour" };
      if (m === "PER_TRIP") return { v: "PER_TRIP", l: "₹ per trip" };
      return { v: m, l: m };
    });
  }
  if (t === "YATRA") {
    return [{ v: "PER_KM", l: "₹ per km" }, { v: "DAILY", l: "₹ per day" }];
  }
  return [
    { v: "DAILY", l: "₹ per day" },
    { v: "HOURLY", l: "₹ per hour" },
    { v: "PER_KM", l: "₹ per km" },
  ];
}
