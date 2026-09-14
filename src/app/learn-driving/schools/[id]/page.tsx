"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Star, MapPin, Phone, Mail, Clock, Users, CheckCircle, Calendar, ArrowLeft } from "lucide-react";

interface SchoolDetails {
  id: string;
  schoolName: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  verified: boolean;
  rating: number;
  ratingCount: number;
  ownerName: string;
  phone: string;
  email: string | null;
  description: string | null;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  courses: any[];
  vehicles: any[];
  instructors: any[];
  reviews: any[];
  completedLessons: number;
  totalStudents: number;
}

export default function SchoolDetailsPage() {
  const params = useParams();
  const id = params?.id as string;
  const [school, setSchool] = useState<SchoolDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [showBooking, setShowBooking] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchSchool = async () => {
      try {
        const response = await fetch(`/api/driving-schools/${id}`);
        const data = await response.json();
        if (data.ok) {
          setSchool(data.school);
        }
      } catch (error) {
        console.error("Error fetching school:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSchool();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-600">Loading school details...</p>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">School not found</p>
          <Link href="/learn-driving" className="text-blue-600 hover:underline">
            Back to search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header with back button */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="container-nw flex items-center gap-4 h-14">
          <Link href="/learn-driving">
            <ArrowLeft className="h-5 w-5 text-gray-600 hover:text-gray-900" />
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">School Details</h1>
        </div>
      </div>

      {/* Cover Image & Logo */}
      <div className="bg-white border-b">
        {school.coverImageUrl && (
          <div className="relative h-64 bg-gray-200">
            <img src={school.coverImageUrl} alt={school.schoolName} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="container-nw px-4 -mt-12 relative z-10 mb-6">
          <div className="flex items-end gap-4">
            {school.logoUrl && (
              <img
                src={school.logoUrl}
                alt="Logo"
                className="h-24 w-24 rounded-xl border-4 border-white shadow-lg object-cover"
              />
            )}
            <div className="flex-1 pb-2">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{school.schoolName}</h1>
                {school.verified && (
                  <CheckCircle className="h-6 w-6 text-green-500 fill-green-500" />
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold">{school.rating}</span>
                  <span className="text-gray-500">({school.ratingCount} reviews)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container-nw py-8 grid grid-cols-1 lg:grid-cols-3 gap-8 px-4">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Quick Stats */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4">Overview</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">{school.completedLessons}</p>
                <p className="text-sm text-gray-600">Lessons Completed</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">{school.totalStudents}</p>
                <p className="text-sm text-gray-600">Students</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">{school.instructors.length}</p>
                <p className="text-sm text-gray-600">Instructors</p>
              </div>
            </div>
          </div>

          {/* Description */}
          {school.description && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-4">About</h2>
              <p className="text-gray-700 leading-relaxed">{school.description}</p>
            </div>
          )}

          {/* Courses */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4">Available Courses</h2>
            <div className="space-y-4">
              {school.courses.length === 0 ? (
                <p className="text-gray-600">No courses available</p>
              ) : (
                school.courses.map((course) => (
                  <div
                    key={course.id}
                    onClick={() => setSelectedCourse(course)}
                    className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{course.name}</h3>
                        <p className="text-sm text-gray-600">
                          {course.numLessons} lessons • {course.duration} min each
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {course.transmission} • {course.vehicleType || "Any vehicle"}
                        </p>
                        {course.description && (
                          <p className="text-sm text-gray-700 mt-2">{course.description}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">₹{course.price}</p>
                        <button
                          onClick={() => setShowBooking(true)}
                          className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
                        >
                          Book Now
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Instructors */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4">Instructors</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {school.instructors.length === 0 ? (
                <p className="text-gray-600">No instructors available</p>
              ) : (
                school.instructors.map((instructor) => (
                  <div key={instructor.id} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900">{instructor.name}</h3>
                    <p className="text-sm text-gray-600">{instructor.experience} years experience</p>
                    {instructor.languages.length > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        Languages: {instructor.languages.join(", ")}
                      </p>
                    )}
                    {instructor.specialization.length > 0 && (
                      <p className="text-sm text-gray-600">
                        Specialization: {instructor.specialization.join(", ")}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Vehicles */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4">Training Vehicles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {school.vehicles.length === 0 ? (
                <p className="text-gray-600">No vehicles listed</p>
              ) : (
                school.vehicles.map((vehicle) => (
                  <div key={vehicle.id} className="border border-gray-200 rounded-lg p-4">
                    {vehicle.imageUrl && (
                      <img
                        src={vehicle.imageUrl}
                        alt={`${vehicle.brand} ${vehicle.model}`}
                        className="w-full h-32 object-cover rounded-lg mb-3"
                      />
                    )}
                    <h3 className="font-semibold text-gray-900">
                      {vehicle.brand} {vehicle.model}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {vehicle.year} • {vehicle.transmission}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Reviews */}
          {school.reviews.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-4">Recent Reviews</h2>
              <div className="space-y-4">
                {school.reviews.map((review) => (
                  <div key={review.id} className="border-b border-gray-200 pb-4 last:border-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < review.rating
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="font-semibold text-gray-900">{review.studentName}</span>
                    </div>
                    {review.comment && (
                      <p className="text-gray-700 text-sm">{review.comment}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="lg:col-span-1">
          {/* Contact Info Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm sticky top-20 space-y-4">
            <h2 className="text-xl font-bold">Contact Information</h2>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <a href={`tel:${school.phone}`} className="text-blue-600 hover:underline">
                  {school.phone}
                </a>
              </div>

              {school.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <a href={`mailto:${school.email}`} className="text-blue-600 hover:underline">
                    {school.email}
                  </a>
                </div>
              )}

              <div className="flex items-start gap-3 pt-3 border-t">
                <MapPin className="h-5 w-5 text-blue-600 flex-shrink-0 mt-1" />
                <div className="text-sm text-gray-700">
                  {school.address}
                  <br />
                  {school.city}, {school.state}
                </div>
              </div>
            </div>

            <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition mt-4">
              Book a Trial Lesson
            </button>

            <button className="w-full bg-gray-100 text-gray-900 py-3 rounded-lg font-semibold hover:bg-gray-200 transition">
              Add to Favorites
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
