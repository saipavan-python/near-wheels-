"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, GraduationCap, Plus, BookOpen, CheckCircle2 } from "lucide-react";

export default function DrivingSchoolManagementPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/driving-schools")
      .then((r) => r.json())
      .then((d) => {
        setLoading(false);
        if (d.ok && d.data?.schools?.length > 0) {
          setCourses(d.data.schools[0].courses || []);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <Link href="/provider/services" className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to Services
        </Link>
        <span className="text-xs font-bold text-emerald-700">Driving Academy</span>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">Driving School Courses & Academy</h1>
          <p className="mt-1 text-xs text-slate-500">
            List beginner driving courses, two-wheeler / four-wheeler training lessons, and course fees.
          </p>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs font-bold text-slate-400">Loading driving school data…</div>
        ) : courses.length === 0 ? (
          <div className="rounded-2xl bg-emerald-50/50 p-6 text-center text-xs space-y-3 border border-emerald-100">
            <GraduationCap className="mx-auto h-8 w-8 text-emerald-600" />
            <p className="font-bold text-emerald-900">Standard 4-Wheeler Beginner Course Active</p>
            <p className="text-emerald-700 max-w-md mx-auto">
              15 lessons × 30 mins (Manual Transmission Car) • ₹4,500 Complete Package
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {courses.map((c) => (
              <div key={c.id} className="rounded-2xl border border-slate-200 p-4 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">{c.vehicleType}</span>
                <h3 className="font-bold text-ink text-base">{c.courseName}</h3>
                <p className="text-xs text-slate-500">{c.numLessons} Lessons • {c.lessonDuration} mins each</p>
                <p className="font-extrabold text-brand-700 text-sm">₹{c.price}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
