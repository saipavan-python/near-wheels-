import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learn Driving — Driving Schools & Courses | Near Wheels",
  description:
    "Find driving schools and instructors near you — book lessons, compare courses and learn to drive with verified professionals.",
  alternates: { canonical: "/learn-driving" },
};

export default function LearnDrivingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
