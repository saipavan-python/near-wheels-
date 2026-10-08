"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App Error:");
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-center">
      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm max-w-md w-full space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Something went wrong!</h2>
        <p className="text-sm text-slate-500">{error.message || "An unexpected error occurred."}</p>
        <button
          onClick={() => reset()}
          className="btn-primary w-full py-2.5"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
