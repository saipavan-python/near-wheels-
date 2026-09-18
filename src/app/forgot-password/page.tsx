import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot password — Reset via OTP | Near Wheels",
  description: "Reset your Near Wheels password with a one-time code sent to your registered mobile number.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-paper px-5 py-14">
      <div className="w-full max-w-md">
        <Link href="/login" className="mb-8 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-mute transition hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>
        <div className="card p-7 shadow-lift sm:p-9">
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}