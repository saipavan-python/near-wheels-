"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Star } from "lucide-react";
import { api } from "@/lib/ui";
import Reveal from "./Reveal";

export default function Reviews() {
  const [idx, setIdx] = useState(0);
  const [reviews, setReviews] = useState<
    { quote: string; name: string; location: string; type: string; rating: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ reviews: { quote: string; name: string; location: string; type: string; rating: number }[] }>("/api/reviews")
      .then((r) => {
        if (r.data?.reviews?.length) setReviews(r.data.reviews);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const displayReviews = reviews.length > 0 ? reviews : [
    { quote: "Finding a car, driver and garage used to mean using three different apps. Near Wheels makes everything simple.", name: "Prashanth Reddy", location: "Nandyal", type: "SUV rental + driver", rating: 5 },
    { quote: "I asked the AI for a self-drive car for a weekend trip and had a confirmed booking in under two minutes.", name: "Sneha K.", location: "Kurnool", type: "Self-drive hatchback", rating: 5 },
    { quote: "My tractor needed emergency repair during harvest. The nearest verified garage arrived the same morning.", name: "Mallikarjuna B.", location: "Kurnool", type: "Emergency garage service", rating: 5 },
    { quote: "The price I was quoted is exactly what I paid. No surprises, no haggling — just clear booking.", name: "Ayesha F.", location: "Nandyal", type: "Outstation driver", rating: 4 },
  ];

  const next = useCallback(() => setIdx((i) => (i + 1) % displayReviews.length), [displayReviews.length]);
  const prev = () => setIdx((i) => (i - 1 + displayReviews.length) % displayReviews.length);

  useEffect(() => {
    const t = setInterval(next, 7000);
    return () => clearInterval(t);
  }, [next, idx]);

  const r = displayReviews[idx];

  return (
    <section id="reviews" className="bg-paper-deep/60 py-20 md:mt-24 md:py-28">
      <div className="container-nw">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="eyebrow">Customer reviews</p>
          {loading ? (
            <div className="mt-6 min-h-[120px] md:min-h-[140px] flex items-center justify-center">
              <div className="skeleton h-8 w-64 mx-auto" />
            </div>
          ) : (
            <blockquote className="mt-6 min-h-[120px] md:min-h-[140px]" aria-live="polite">
              <p className="font-display text-2xl font-bold leading-snug tracking-tight md:text-[2rem]">
                &ldquo;{r.quote}&rdquo;
              </p>
            </blockquote>
          )}
          <div className="mt-4 flex justify-center gap-1" aria-label={`${r.rating} out of 5 stars`}>
            {Array.from({ length: r.rating }).map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <p className="mt-3 text-sm font-semibold">
            {r.name} <span className="font-normal text-ink-mute">· {r.location} · {r.type}</span>
          </p>

          <div className="mt-8 flex items-center justify-center gap-4">
            <button onClick={prev} aria-label="Previous review" className="grid h-10 w-10 place-items-center rounded-full border border-ink/15 bg-white transition hover:border-brand-500 hover:text-brand-600">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex gap-1.5">
              {displayReviews.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  aria-label={`Go to review ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-brand-500" : "w-1.5 bg-ink/20 hover:bg-ink/40"}`}
                />
              ))}
            </div>
            <button onClick={next} aria-label="Next review" className="grid h-10 w-10 place-items-center rounded-full border border-ink/15 bg-white transition hover:border-brand-500 hover:text-brand-600">
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
