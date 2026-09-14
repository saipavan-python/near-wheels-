"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, MapPin, BookOpen, ArrowRight } from "lucide-react";

interface Booking {
  id: string;
  code: string;
  status: string;
  scheduledDate: string;
  schoolName: string;
  courseName: string;
  totalAmount: number;
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const loadBookings = async () => {
      try {
        const studentId = localStorage.getItem("userId"); // Get from auth
        if (!studentId) {
          window.location.href = "/";
          return;
        }

        const response = await fetch(`/api/driving-bookings?studentId=${studentId}`);
        const data = await response.json();

        if (data.ok) {
          setBookings(
            data.bookings.map((b: any) => ({
              id: b.id,
              code: b.code,
              status: b.status,
              scheduledDate: b.scheduledDate,
              schoolName: b.school.schoolName,
              courseName: b.course.courseName,
              totalAmount: b.totalAmount,
            }))
          );
        }
      } catch (error) {
        console.error("Error loading bookings:");
      } finally {
        setLoading(false);
      }
    };

    loadBookings();
  }, []);

  const filteredBookings = bookings.filter((b) => {
    if (filter === "upcoming")
      return b.status === "CONFIRMED" || b.status === "PENDING";
    if (filter === "completed") return b.status === "COMPLETED";
    return true;
  });

  const statusBadgeColor = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return "bg-green-100 text-green-800";
      case "PENDING":
        return "bg-blue-100 text-blue-800";
      case "COMPLETED":
        return "bg-gray-100 text-gray-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="container-nw max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Driving Lessons</h1>
          <p className="text-gray-600">Track and manage your booked driving lessons</p>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-200">
          {[
            { id: "all", label: "All Bookings" },
            { id: "upcoming", label: "Upcoming" },
            { id: "completed", label: "Completed" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`py-2 px-4 font-medium border-b-2 transition ${
                filter === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Bookings List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading your bookings...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">No bookings found</p>
            <Link
              href="/learn-driving"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Browse Driving Schools
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <Link key={booking.id} href={`/learn-driving/bookings/${booking.id}`}>
                <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900">{booking.schoolName}</h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadgeColor(
                            booking.status
                          )}`}
                        >
                          {booking.status}
                        </span>
                      </div>

                      <p className="text-gray-600 mb-3">{booking.courseName}</p>

                      <div className="flex flex-wrap gap-6">
                        {booking.scheduledDate && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="h-4 w-4" />
                            {new Date(booking.scheduledDate).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="font-semibold text-gray-900">â‚¹{booking.totalAmount}</span>
                        </div>

                        <div className="text-xs text-gray-500">ID: {booking.code}</div>
                      </div>
                    </div>

                    <div className="ml-4">
                      <ArrowRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
