import Link from "next/link";
import { MapPin, Search, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 py-20">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-brand-50">
          <MapPin className="h-10 w-10 text-brand-500" />
        </div>
        <h1 className="font-display text-6xl font-black text-ink">404</h1>
        <p className="mt-4 text-lg font-medium text-ink">
          Oops! We couldn&apos;t find that page.
        </p>
        <p className="mt-2 text-sm text-ink-mute">
          The page you&apos;re looking for may have been moved or doesn&apos;t exist yet.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="btn-primary inline-flex items-center justify-center gap-2 !px-6 !py-3"
          >
            <Home className="h-4 w-4" />
            Go Home
          </Link>
          <Link
            href="/vehicles"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <Search className="h-4 w-4" />
            Find Vehicles
          </Link>
        </div>
      </div>
    </div>
  );
}