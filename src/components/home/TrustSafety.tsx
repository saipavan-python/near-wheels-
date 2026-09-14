import { ShieldCheck, BadgeCheck, Lock, ReceiptText, Star, Headset } from "lucide-react";
import Reveal from "./Reveal";

const ITEMS = [
  { Icon: ShieldCheck, title: "Verified vehicles", desc: "Documents checked before listing." },
  { Icon: BadgeCheck, title: "Verified drivers", desc: "Licence and background verified." },
  { Icon: Lock, title: "Secure payments", desc: "Money moves through the platform only." },
  { Icon: ReceiptText, title: "Transparent pricing", desc: "The quote you see is the price you pay." },
  { Icon: Star, title: "Real reviews", desc: "Only completed bookings can be reviewed." },
  { Icon: Headset, title: "24/7 assistance", desc: "Help before, during and after every trip." },
];

export default function TrustSafety() {
  return (
    <section id="trust" className="container-nw pt-20 md:pt-28">
      <Reveal className="max-w-2xl">
        <p className="eyebrow">Trust & safety</p>
        <h2 className="section-title mt-2">Move with confidence.</h2>
      </Reveal>
      <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map(({ Icon, title, desc }, i) => (
          <Reveal key={title} delay={(i % 3) * 0.08}>
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <h3 className="font-display font-bold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-mute">{desc}</p>
              </span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
