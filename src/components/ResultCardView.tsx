"use client";

import type { ResultCard } from "@/lib/ui";
import { vehicleImage, portraitImage, garageImage } from "@/lib/imagery";
import { IconStar } from "./icons";
import { BadgeCheck, MapPin, Zap, CalendarClock, Sparkles, CarFront, UserRound, Wrench, Tractor, Cpu } from "lucide-react";

const KIND_ICON: Record<string, any> = {
  VEHICLE: CarFront,
  DRIVER: UserRound,
  GARAGE: Wrench,
  FARM: Tractor,
  DRONE: Cpu,
};

const TONE_CLASS: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-600",
  blue: "bg-sky-50 text-sky-700",
  gray: "bg-paper-deep text-ink-mute",
};

function cardImage(c: ResultCard): string {
  switch (c.kind) {
    case "DRIVER": return portraitImage(c.id);
    case "GARAGE": return garageImage(c.id);
    case "FARM": return vehicleImage(c.title, "TRACTOR");
    case "DRONE": return vehicleImage("crop spraying drone", "DRONE");
    default: return vehicleImage(c.title, c.category);
  }
}

export function AvailabilityPill({ available, label }: { available: boolean; label?: string }) {
  return (
    <span
      className={`badge px-2.5 py-1 shadow-sm ${
        available ? "bg-emerald-500/95 text-white" : "bg-black/55 text-white backdrop-blur-sm"
      }`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {available && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${available ? "bg-white" : "bg-white/60"}`} />
      </span>
      {label ?? (available ? "Available now" : "Scheduled only")}
    </span>
  );
}

/** Universal result card — renders every listing kind from the shared matching engine. */
export default function ResultCardView({
  card,
  index,
  bestMatch = false,
  compact = false,
  selected = false,
  onBook,
  onCompare,
}: {
  card: ResultCard;
  index?: number;
  bestMatch?: boolean;
  compact?: boolean;
  selected?: boolean;
  onBook?: (card: ResultCard) => void;
  onCompare?: (card: ResultCard) => void;
}) {
  const dist = card.distanceKm != null ? `${card.distanceKm.toFixed(1)} km` : null;

  // Garages show live open/closed state driven by their registered opening hours.
  const garagePill =
    card.kind === "GARAGE"
      ? card.availableNow
        ? "Open now"
        : typeof card.meta.openDetail === "string"
          ? card.meta.openDetail
          : "Closed now"
      : undefined;

  if (compact) {
    return (
      <article className={`card card-lift relative overflow-hidden p-3 ${selected ? "ring-2 ring-brand-500" : ""}`}>
        <div className="flex items-start gap-3">
          <img
            src={cardImage(card)}
            alt=""
            loading="lazy"
            className="h-14 w-14 shrink-0 rounded-xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold">{card.title}</h3>
            <p className="mt-0.5 truncate text-xs text-ink-mute">{card.subtitle}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-medium text-ink-mute">
              <AvailabilityPill available={card.availableNow} label={garagePill} />
              {dist && <span>{dist}{card.etaMin != null ? ` · ${card.etaMin} min` : ""}</span>}
              {card.rating > 0 && (
                <span className="inline-flex items-center gap-0.5 font-bold text-ink">
                  <IconStar className="h-3 w-3" /> {card.rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink/[0.06] pt-3">
          <span className="text-sm font-extrabold tracking-tight">{card.priceLabel}</span>
          {onBook && (
            <button
              className={`min-h-[44px] !rounded-xl !px-5 !py-2.5 text-sm font-bold transition active:scale-[0.98] ${card.availableNow ? "btn-primary" : "btn-outline"}`}
              onClick={() => onBook(card)}
              aria-label={`Book ${card.title}`}
            >
              {card.availableNow ? "Book Now" : "Book Later"}
            </button>
          )}
        </div>
      </article>
    );
  }

  return (
    <article
      className={`card-lift group relative overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-black/[0.04] ${
        selected ? "ring-2 ring-brand-500" : ""
      }`}
    >
      <div className="relative overflow-hidden">
        <img
          src={cardImage(card)}
          alt={card.title}
          loading="lazy"
          className="h-44 w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent" />

        {bestMatch && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-brand-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
            <Zap className="h-3 w-3" /> Best match
          </span>
        )}

        <span className="absolute right-3 top-3"><AvailabilityPill available={card.availableNow} label={garagePill} /></span>

        <span
          aria-hidden
          className="absolute bottom-3 left-3 grid h-9 w-9 place-items-center rounded-xl bg-white/90 text-brand-600 shadow-sm backdrop-blur-sm"
        >
          {(() => {
            const I = KIND_ICON[card.kind] || CarFront;
            return <I className="h-[18px] w-[18px]" />;
          })()}
        </span>

        {typeof index === "number" && (
          <span className="absolute bottom-3 right-3 font-display text-xs font-bold text-white/85">
            #{index}
          </span>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate font-display text-lg font-bold leading-snug">{card.title}</h3>
          {card.rating > 0 && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-paper px-2 py-0.5 text-xs font-bold">
              <IconStar className="h-3.5 w-3.5" /> {card.rating.toFixed(1)}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-ink-mute">{card.subtitle}</p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-ink-mute">
          {dist && (
            <span className="inline-flex items-center gap-1 rounded-full bg-paper-deep px-2 py-1">
              <MapPin className="h-3 w-3 text-brand-600" />
              {dist}{card.etaMin != null ? ` · ${card.etaMin} min` : ""}
            </span>
          )}
          {card.verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
              <BadgeCheck className="h-3 w-3" /> Verified
            </span>
          )}
          {card.badges?.slice(0, 2).map((b) => (
            <span key={b.label} className={`badge ${TONE_CLASS.blue}`}>
              {b.icon} {b.label}
            </span>
          ))}
        </div>

        {card.reason && (
          <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-brand-50/80 px-3 py-2 text-xs font-medium leading-relaxed text-brand-900">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
            Best for you — {card.reason.toLowerCase()}.
          </p>
        )}

        {(onBook || onCompare) && (
          <div className="mt-4 flex items-center gap-2 border-t border-ink/[0.06] pt-4">
            <div className="min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-faint">From</span>
              <span className="font-display text-lg font-extrabold tracking-tight text-brand-600">
                {card.priceLabel}
              </span>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {onCompare && (
                <button className="btn-outline min-h-[44px] !rounded-xl !px-4 !py-2.5 text-sm" onClick={() => onCompare(card)} aria-label={`Compare ${card.title}`}>
                  Compare
                </button>
              )}
              {onBook && (
                <button
                  className={`min-h-[44px] !rounded-xl !px-5 !py-2.5 text-sm font-bold transition active:scale-[0.98] ${card.availableNow ? "btn-primary" : "btn-dark"}`}
                  onClick={() => onBook(card)}
                  aria-label={`Book ${card.title}`}
                >
                  {card.availableNow ? <><Zap className="h-3.5 w-3.5" /> Book Now</> : <><CalendarClock className="h-3.5 w-3.5" /> Book Later</>}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-black/[0.04]" aria-hidden>
      <div className="skeleton h-44 w-full rounded-none" />
      <div className="space-y-2.5 p-5">
        <div className="skeleton h-5 w-2/3" />
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton h-3 w-24" />
        <div className="mt-4 flex justify-between border-t border-ink/[0.06] pt-4">
          <div className="skeleton h-6 w-20" />
          <div className="skeleton h-9 w-28" />
        </div>
      </div>
    </div>
  );
}
