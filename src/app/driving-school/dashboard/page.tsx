"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, BookOpen, UserCheck, Calendar, Zap, Settings, Plus, ArrowRight, BarChart2, Star } from "lucide-react";

interface DashboardData {
  totalStudents: number;
  upcomingLessons: number;
  activeCourses: number;
  totalBookings: number;
  completedLessons: number;
  averageRating: number;
}

export default function DrivingSchoolDashboardPage() {
  const [school, setSchool] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const schoolId = localStorage.getItem("schoolId");
        if (!schoolId) {
          window.location.href = "/driving-school/register";
          return;
        }

        const storedName = localStorage.getItem("schoolName") || "Your Driving School";
        const storedPhone = localStorage.getItem("schoolPhone") || "";

        // Try fetching school from API
        try {
          const res = await fetch(`/api/driving-schools/${schoolId}`);
          const data = await res.json();
          if (data.ok && data.school) {
            setSchool(data.school);
          } else {
            setSchool({
              id: schoolId,
              schoolName: storedName,
              phone: storedPhone,
              status: "PENDING_VERIFICATION",
            });
          }
        } catch {
          setSchool({
            id: schoolId,
            schoolName: storedName,
            phone: storedPhone,
            status: "PENDING_VERIFICATION",
          });
        }

        setDashboardData({
          totalStudents: 0,
          upcomingLessons: 0,
          activeCourses: 0,
          totalBookings: 0,
          completedLessons: 0,
          averageRating: 5.0,
        });
      } catch (error) {
        console.error("Error loading dashboard:");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No school registered</p>
          <Link
            href="/driving-school/register"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Register Your School
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container-nw px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{school.schoolName}</h1>
              <p className="text-gray-600 mt-1">Driving School Owner Dashboard</p>
            </div>
            <Link href="/driving-school/dashboard/settings" className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
              <Settings className="h-5 w-5" />
              Settings
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container-nw px-4 py-8">
        {/* Stats Grid */}
        {dashboardData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* Total Students */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total Students</p>
                  <p className="text-3xl font-bold text-gray-900">{dashboardData.totalStudents}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            {/* Upcoming Lessons */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Upcoming Lessons</p>
                  <p className="text-3xl font-bold text-gray-900">{dashboardData.upcomingLessons}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            {/* Active Courses */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Active Courses</p>
                  <p className="text-3xl font-bold text-gray-900">{dashboardData.activeCourses}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>

            {/* Completed Lessons */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Completed Lessons</p>
                  <p className="text-3xl font-bold text-gray-900">{dashboardData.completedLessons}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Zap className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </div>

            {/* Total Bookings */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total Bookings</p>
                  <p className="text-3xl font-bold text-gray-900">{dashboardData.totalBookings}</p>
                </div>
                <div className="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-pink-600" />
                </div>
              </div>
            </div>

            {/* Average Rating */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Average Rating</p>
                  <p className="text-3xl font-bold text-gray-900">{dashboardData.averageRating}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <Star className="h-6 w-6 text-red-500 fill-red-100" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <div className="flex gap-8">
              {[
                { id: "overview", label: "Overview", icon: BarChart2 },
                { id: "courses", label: "Courses", icon: BookOpen },
                { id: "instructors", label: "Instructors", icon: UserCheck },
                { id: "bookings", label: "Bookings", icon: Calendar },
                { id: "vehicles", label: "Vehicles", icon: Zap },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-2 font-medium border-b-2 transition flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <tab.icon className="h-4 w-4" /> {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Quick Actions</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link href="/driving-school/dashboard/courses/create" className="p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition text-center group">
                  <Plus className="h-8 w-8 text-gray-400 group-hover:text-blue-600 mx-auto mb-2" />
                  <p className="font-semibold text-gray-900">Create New Course</p>
                  <p className="text-sm text-gray-600">Add a new driving course</p>
                </Link>

                <Link href="/driving-school/dashboard/instructors/invite" className="p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition text-center group">
                  <Plus className="h-8 w-8 text-gray-400 group-hover:text-blue-600 mx-auto mb-2" />
                  <p className="font-semibold text-gray-900">Add Instructor</p>
                  <p className="text-sm text-gray-600">Invite a new instructor</p>
                </Link>

                <Link href="/driving-school/dashboard/vehicles/add" className="p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition text-center group">
                  <Plus className="h-8 w-8 text-gray-400 group-hover:text-blue-600 mx-auto mb-2" />
                  <p className="font-semibold text-gray-900">Add Vehicle</p>
                  <p className="text-sm text-gray-600">Register a training vehicle</p>
                </Link>

                <Link href="/driving-school/dashboard/bookings" className="p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition text-center group">
                  <Calendar className="h-8 w-8 text-gray-400 group-hover:text-blue-600 mx-auto mb-2" />
                  <p className="font-semibold text-gray-900">View All Bookings</p>
                  <p className="text-sm text-gray-600">Manage student bookings</p>
                </Link>
              </div>
            </div>
          )}

          {activeTab === "courses" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Your Courses</h2>
                <Link href="/driving-school/dashboard/courses/create" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                  + New Course
                </Link>
              </div>
              <div className="text-center py-8">
                <p className="text-gray-600">No courses yet. Create your first course to get started!</p>
              </div>
            </div>
          )}

          {activeTab === "instructors" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Your Instructors</h2>
                <Link href="/driving-school/dashboard/instructors/invite" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                  + Add Instructor
                </Link>
              </div>
              <div className="text-center py-8">
                <p className="text-gray-600">No instructors added yet.</p>
              </div>
            </div>
          )}

          {activeTab === "bookings" && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">Bookings</h2>
              <div className="text-center py-8">
                <p className="text-gray-600">No bookings yet.</p>
              </div>
            </div>
          )}

          {activeTab === "vehicles" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Training Vehicles</h2>
                <Link href="/driving-school/dashboard/vehicles/add" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                  + Add Vehicle
                </Link>
              </div>
              <div className="text-center py-8">
                <p className="text-gray-600">No vehicles registered yet.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
