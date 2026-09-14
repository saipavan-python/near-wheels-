"use client";

import { useState } from "react";
import { MessageCircleQuestion, CalendarPlus } from "lucide-react";
import type { ResultCard } from "@/lib/ui";
import BookingSheet from "../BookingSheet";

/**
 * CTA block used by vehicle/driver/garage detail pages.
 * Reuses the shared BookingSheet (quote → book → pay) so pricing
 * always comes from the backend engine — never computed in the UI.
 */
export default function BookingLauncher({
  card,
  ctaLabel,
  acresHint,
}: {
  card: ResultCard;
  ctaLabel: string;
  acresHint?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="space-y-3">
        <button onClick={() => setOpen(true)} className="btn-primary w-full !rounded-xl !py-3.5">
          <CalendarPlus className="h-4 w-4" />
          {ctaLabel}
        </button>
        <button
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("nw:ai-ask", {
                detail: { text: `Tell me about ${card.title}` },
              })
            )
          }
          className="btn-outline w-full !rounded-xl !py-3.5"
        >
          <MessageCircleQuestion className="h-4 w-4 text-brand-500" />
          Ask AI about this
        </button>
      </div>
      {open && <BookingSheet card={card} acresHint={acresHint} onClose={() => setOpen(false)} />}
    </>
  );
}
