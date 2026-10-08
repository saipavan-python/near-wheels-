"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronLeft, MapPin } from "lucide-react";

const steps = [
  { id: 1, name: "School Info", title: "School Information" },
  { id: 2, name: "Location", title: "Location Details" },
  { id: 3, name: "Services", title: "Services Offered" },
  { id: 4, name: "Review", title: "Review & Submit" },
];

export default function DrivingSchoolRegisterPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    schoolName: "",
    ownerName: "",
    phone: "",
    email: "",
    description: "",
    establishedYear: new Date().getFullYear(),
    businessRegistration: "",
    address: "",
    area: "",
    city: "",
    state: "",
    pincode: "",
    lat: 0,
    lng: 0,
    services: [] as string[],
  });

  const services = [
    { value: "BEGINNER_DRIVING", label: "Beginner Driving" },
    { value: "MANUAL_DRIVING", label: "Manual Driving" },
    { value: "AUTOMATIC_DRIVING", label: "Automatic Driving" },
    { value: "REFRESHER_DRIVING", label: "Refresher Driving" },
    { value: "HIGHWAY_TRAINING", label: "Highway Training" },
    { value: "PARKING_PRACTICE", label: "Parking Practice" },
    { value: "DEFENSIVE_DRIVING", label: "Defensive Driving" },
    { value: "LICENSE_PREPARATION", label: "License Preparation" },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "establishedYear" || name === "lat" || name === "lng" ? Number(value) : value,
    }));
  };

  const handleServiceToggle = (service: string) => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter((s) => s !== service)
        : [...prev.services, service],
    }));
  };

  const useMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData((prev) => ({
            ...prev,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }));
        },
        (error) => {
          console.error("Error getting location:");
          alert("Could not get your location");
        }
      );
    }
  };

  const handleSubmit = async () => {
    if (!formData.schoolName || !formData.ownerName || !formData.phone || !formData.city) {
      alert("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/driving-schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          userId: localStorage.getItem("userId"), // You'd get this from your auth system
        }),
      });

      const data = await response.json();

      if (data.ok) {
        const id = data.schoolId || data.school?.id;
        if (id) {
          localStorage.setItem("schoolId", id);
        }
        localStorage.setItem("schoolName", formData.schoolName);
        localStorage.setItem("ownerName", formData.ownerName);
        localStorage.setItem("schoolPhone", formData.phone);

        alert("Registration submitted successfully! Redirecting to your dashboard...");
        window.location.href = "/driving-school/dashboard";
      } else {
        alert(data.error || "Registration failed");
      }
    } catch (error) {
      console.error("Error registering:");
      alert("Error submitting registration");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block">
            â† Back to Home
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Register Your Driving School</h1>
          <p className="text-gray-600 mt-2">Join our network of trusted driving schools and start accepting students</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, idx) => (
              <div key={step.id} className="flex items-center flex-1">
                <button
                  onClick={() => setCurrentStep(step.id)}
                  className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold transition ${
                    currentStep >= step.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {step.id}
                </button>
                {idx < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 transition ${
                      currentStep > step.id ? "bg-blue-600" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-gray-600">
            Step {currentStep} of {steps.length}: {steps[currentStep - 1].title}
          </p>
        </div>

        {/* Form Content */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          {/* Step 1: School Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">School Name *</label>
                <input
                  type="text"
                  name="schoolName"
                  value={formData.schoolName}
                  onChange={handleInputChange}
                  placeholder="e.g., Safe Drive Academy"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Owner Name *</label>
                  <input
                    type="text"
                    name="ownerName"
                    value={formData.ownerName}
                    onChange={handleInputChange}
                    placeholder="Full name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="10-digit phone number"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Established Year</label>
                  <input
                    type="number"
                    name="establishedYear"
                    value={formData.establishedYear}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Tell us about your driving school..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Business Registration Number</label>
                <input
                  type="text"
                  name="businessRegistration"
                  value={formData.businessRegistration}
                  onChange={handleInputChange}
                  placeholder="Optional"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Step 2: Location */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address *</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Full address"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Area</label>
                  <input
                    type="text"
                    name="area"
                    value={formData.area}
                    onChange={handleInputChange}
                    placeholder="Locality/Area"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City *</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="City"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State *</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    placeholder="State"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pincode</label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleInputChange}
                    placeholder="Postal code"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Coordinates</label>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <input
                    type="number"
                    name="lat"
                    value={formData.lat}
                    onChange={handleInputChange}
                    placeholder="Latitude"
                    step="0.0001"
                    className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="number"
                    name="lng"
                    value={formData.lng}
                    onChange={handleInputChange}
                    placeholder="Longitude"
                    step="0.0001"
                    className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={useMyLocation}
                  className="w-full px-4 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition font-medium flex items-center justify-center gap-2"
                >
                  <MapPin className="h-4 w-4" />
                  Use My Location
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Services */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">Select Services Offered *</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {services.map((service) => (
                    <button
                      key={service.value}
                      onClick={() => handleServiceToggle(service.value)}
                      className={`p-4 border-2 rounded-lg text-left font-medium transition ${
                        formData.services.includes(service.value)
                          ? "border-blue-600 bg-blue-50 text-blue-900"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center">
                        <div
                          className={`w-5 h-5 rounded border-2 mr-3 flex items-center justify-center ${
                            formData.services.includes(service.value)
                              ? "bg-blue-600 border-blue-600"
                              : "border-gray-300"
                          }`}
                        >
                          {formData.services.includes(service.value) && (
                            <span className="text-white text-sm">âœ“</span>
                          )}
                        </div>
                        {service.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  âœ“ Please review your information below. After submission, your school will be under verification.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-4">School Information</h3>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-gray-600">School Name:</span> <span className="font-medium">{formData.schoolName}</span>
                  </p>
                  <p>
                    <span className="text-gray-600">Owner:</span> <span className="font-medium">{formData.ownerName}</span>
                  </p>
                  <p>
                    <span className="text-gray-600">Phone:</span> <span className="font-medium">{formData.phone}</span>
                  </p>
                  <p>
                    <span className="text-gray-600">Email:</span> <span className="font-medium">{formData.email || "Not provided"}</span>
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Location</h3>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-gray-600">Address:</span> <span className="font-medium">{formData.address}</span>
                  </p>
                  <p>
                    <span className="text-gray-600">City:</span> <span className="font-medium">{formData.city}</span>
                  </p>
                  <p>
                    <span className="text-gray-600">State:</span> <span className="font-medium">{formData.state}</span>
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Services</h3>
                <div className="flex flex-wrap gap-2">
                  {formData.services.length === 0 ? (
                    <p className="text-sm text-gray-600">No services selected</p>
                  ) : (
                    formData.services.map((service) => (
                      <span key={service} className="px-3 py-1 bg-blue-100 text-blue-900 text-sm rounded-full">
                        {services.find((s) => s.value === service)?.label}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-5 w-5" />
            Previous
          </button>

          <button
            onClick={() => {
              if (currentStep === steps.length) {
                handleSubmit();
              } else {
                setCurrentStep(currentStep + 1);
              }
            }}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentStep === steps.length ? (
              loading ? (
                "Submitting..."
              ) : (
                "Submit Registration"
              )
            ) : (
              <>
                Next
                <ChevronRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
