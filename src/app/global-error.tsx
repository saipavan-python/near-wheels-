"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Error:", error);
  }, [error]);

  return (
    <html>
      <body className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-center font-sans">
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm max-w-md w-full space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Application Error</h2>
          <p className="text-sm text-slate-500">{error.message || "A critical error occurred."}</p>
          <button
            onClick={() => reset()}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 w-full"
          >
            Refresh Application
          </button>
        </div>
      </body>
    </html>
  );
}
