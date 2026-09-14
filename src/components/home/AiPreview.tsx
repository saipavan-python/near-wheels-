"use client";

import { Sparkles } from "lucide-react";
import Reveal from "./Reveal";
import { IMGS, vehicleImage } from "@/lib/imagery";

const EXAMPLES = [
  "Find me an SUV for 3 days.",
  "Which car is best for a family trip?",
  "Find a garage for brake repair near me.",
];

function ask(text?: string) {
  window.dispatchEvent(new CustomEvent("nw:ai-ask", { detail: { text } }));
}

export default function AiPreview() {
  return (
    <section id="ai" className="container-nw pt-20 md:pt-28">
      <Reveal>
        <div className="grid overflow-hidden rounded-[2rem] bg-ink text-white shadow-lift lg:grid-cols-2">
          <div className="p-8 md:p-12 lg:p-14">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.28em] text-brand-400">
              <Sparkles className="h-4 w-4" /> Near Wheels AI
            </p>
            <h2 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
              A concierge that knows the road.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/60 md:text-base">
              Ask in your own words. The assistant checks live availability, real prices and
              your bookings — then hands you cards you can act on instantly.
            </p>

            <div className="mt-7 flex flex-wrap gap-2">
              {EXAMPLES.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-medium text-white/85 transition hover:border-brand-400 hover:text-brand-300"
                >
                  “{q}”
                </button>
              ))}
            </div>

            <button onClick={() => ask()} className="btn-primary mt-8 !rounded-full !px-6 !py-3">
              <Sparkles className="h-4 w-4" /> Ask Near Wheels
            </button>
          </div>

          {/* decorative live-chat mock */}
          <div className="relative min-h-[380px]">
            <img src={IMGS.aiSide} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
            <div className="absolute inset-0 flex items-center justify-center p-6 md:p-10">
              <div className="sheet-in w-full max-w-sm rounded-3xl bg-paper p-4 text-ink shadow-panel">
                <div className="flex items-center gap-2 border-b border-ink/[0.06] pb-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-500">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </span>
                  <span className="text-sm font-bold">Near Wheels AI</span>
                  <span className="ml-auto flex h-2 w-2 rounded-full bg-emerald-500" />
                </div>
                <div className="space-y-3 pt-4 text-sm">
                  <p className="chat-bubble-user !max-w-[90%]">Find an SUV for tomorrow</p>
                  <p className="chat-bubble-bot !bg-white">I found 6 available SUVs near you. Here are the closest:</p>
                  <div className="ml-auto flex max-w-[92%] items-center gap-3 rounded-2xl rounded-br-sm bg-white p-2.5 shadow-card">
                    <img src={vehicleImage("Toyota Innova Crysta")} alt="" className="h-12 w-16 rounded-lg object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold">Toyota Innova Crysta</span>
                      <span className="block text-[11px] text-ink-mute">5 km ·  4.8 · 7 seats</span>
                    </span>
                    <span className="rounded-full bg-brand-500 px-3 py-1.5 text-[11px] font-bold text-white">Book</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
