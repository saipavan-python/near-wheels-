"use client";

import { useEffect, useState } from "react";
import { Star, MessageSquare, ShieldCheck } from "lucide-react";

export default function ReviewsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/providers/me")
      .then((r) => r.json())
      .then((d) => {
        setLoading(false);
        if (d.ok) setData(d.data);
      })
      .catch(() => setLoading(false));
  }, []);

  const reviews = data?.reviews || [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">Customer Reviews & Ratings</h1>
        <p className="mt-1 text-xs text-ink-mute">
          See ratings and feedback left by customers after completed rentals.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overall Rating</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-display text-4xl font-extrabold text-ink">{data?.provider?.ratingAvg || 4.8}</span>
            <div className="flex text-amber-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-current" />
              ))}
            </div>
          </div>
        </div>

        <span className="rounded-full bg-brand-50 border border-brand-200 px-4 py-2 text-xs font-extrabold text-brand-800">
          Top Rated Provider Badge
        </span>
      </div>

      {/* Reviews list */}
      <div className="space-y-3">
        {reviews.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-xs text-slate-500">
            No customer reviews yet. Ratings appear here after customers complete trips.
          </div>
        ) : (
          reviews.map((r: any) => (
            <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink text-sm">{r.userName || "Verified Customer"}</span>
                <div className="flex text-amber-400">
                  {[...Array(r.rating || 5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-600 italic">"{r.comment || "Great vehicle condition and smooth experience."}"</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
