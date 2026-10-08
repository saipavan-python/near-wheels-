"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Calendar, Clock, MapPin, User, Award } from "lucide-react";

interface BookingData {
  id: string;
  code: string;
  status: string;
  totalAmount: number;
  scheduledDate: string;
  scheduledTime: string;
  school: {
    schoolName: string;
    phone: string;
    address: string;
  };
  course: {
    courseName: string;
    price: number;
    numLessons: number;
  };
  instructor: {
    name: string;
  } | null;
  vehicle: {
    brand: string;
    model: string;
  } | null;
  progress: {
    lessonsCompleted: number;
    totalLessons: number;
  } | null;
}

export default function BookingDetailsPage() {
  const params = useParams();
  const id = params?.id as string;
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const fetchBooking = async () => {
      try {
        const response = await fetch(`/api/driving-bookings/${id}`);
        const data = await response.json();
        if (data.ok) {
          setBooking(data.booking);
        }
      } catch (error) {
        console.error("Error fetching booking:");
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading booking details...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Booking not found</p>
          <Link href="/learn-driving" className="text-blue-600 hover:underline">
            Back to explore
          </Link>
        </div>
      </div>
    );
  }

  const isConfirmed = booking.status === "CONFIRMED";
  const progressPercent = booking.progress
    ? Math.round((booking.progress.lessonsCompleted / booking.progress.totalLessons) * 100)
    : 0;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="container-nw flex items-center gap-4 h-14">
          <Link href="/learn-driving/bookings">
            <ArrowLeft className="h-5 w-5 text-gray-600 hover:text-gray-900" />
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">Booking Details</h1>
        </div>
      </div>

      <div className="container-nw py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Status Card */}
          <div className={`rounded-xl p-8 mb-8 text-center ${isConfirmed ? "bg-green-50 border border-green-200" : "bg-blue-50 border border-blue-200"}`}>
            {isConfirmed ? (
              <>
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-green-900 mb-2">Booking Confirmed!</h2>
                <p className="text-green-800 mb-4">Your driving lesson is all set</p>
                <p className="text-3xl font-bold text-green-900">{booking.code}</p>
              </>
            ) : (
              <>
                <Calendar className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-blue-900 mb-2">Booking Pending</h2>
                <p className="text-blue-800">Waiting for school confirmation</p>
              </>
            )}
          </div>

          {/* Main Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Left Column */}
            <div className="space-y-6">
              {/* School */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">Driving School</h3>
                <p className="text-lg font-bold text-gray-900">{booking.school.schoolName}</p>
                <p className="text-sm text-gray-600 mt-2 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {booking.school.address}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  ðŸ“ž {booking.school.phone}
                </p>
              </div>

              {/* Course */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">Course Details</h3>
                <p className="text-lg font-bold text-gray-900">{booking.course.courseName}</p>
                <div className="mt-4 space-y-2 text-sm">
                  <p>
                    <span className="text-gray-600">Total Lessons:</span> <span className="font-semibold">{booking.course.numLessons}</span>
                  </p>
                  <p>
                    <span className="text-gray-600">Price per Lesson:</span> <span className="font-semibold">â‚¹{booking.course.price}</span>
                  </p>
                </div>
              </div>

              {/* Scheduled Lesson */}
              {booking.scheduledDate && (
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-4">Scheduled Lesson</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="text-sm text-gray-600">Date</p>
                        <p className="font-semibold text-gray-900">
                          {new Date(booking.scheduledDate).toLocaleDateString("en-IN", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    {booking.scheduledTime && (
                      <div className="flex items-center gap-3">
                        <Clock className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="text-sm text-gray-600">Time</p>
                          <p className="font-semibold text-gray-900">{booking.scheduledTime}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Instructor */}
              {booking.instructor && (
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-4">Your Instructor</h3>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="h-6 w-6 text-blue-600" />
                    </div>
                    <p className="text-lg font-bold text-gray-900">{booking.instructor.name}</p>
                  </div>
                </div>
              )}

              {/* Vehicle */}
              {booking.vehicle && (
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-4">Training Vehicle</h3>
                  <p className="text-lg font-bold text-gray-900">
                    {booking.vehicle.brand} {booking.vehicle.model}
                  </p>
                </div>
              )}

              {/* Progress */}
              {booking.progress && (
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-4">Your Progress</h3>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">
                        {booking.progress.lessonsCompleted} of {booking.progress.totalLessons} lessons
                      </span>
                      <span className="text-sm font-semibold text-gray-900">{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    {booking.progress.lessonsCompleted === booking.progress.totalLessons
                      ? "Course Completed!"
                      : `${booking.progress.totalLessons - booking.progress.lessonsCompleted} lessons remaining`}
                  </p>
                </div>
              )}

              {/* Price Summary */}
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">Payment Details</h3>
                <div className="space-y-2 mb-4 border-b pb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Course Price</span>
                    <span className="font-semibold text-gray-900">â‚¹{booking.totalAmount}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-blue-600">â‚¹{booking.totalAmount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3 mb-8">
            <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
              Contact School
            </button>
            <button className="w-full bg-gray-100 text-gray-900 py-3 rounded-lg font-semibold hover:bg-gray-200 transition">
              Reschedule Lesson
            </button>
          </div>

          {/* Footer */}
          <div className="text-center">
            <Link href="/learn-driving/bookings" className="text-blue-600 hover:underline text-sm">
              View all my bookings
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
