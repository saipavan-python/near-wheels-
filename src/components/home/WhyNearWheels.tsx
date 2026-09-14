import Reveal from "./Reveal";

const BENEFITS = [
  { title: "One platform", desc: "Cars, drivers and garages together." },
  { title: "Verified", desc: "Trusted vehicles, drivers and service providers." },
  { title: "Intelligent", desc: "AI-powered recommendations and assistance." },
  { title: "Convenient", desc: "Discover, book and manage everything in one place." },
];

export default function WhyNearWheels() {
  return (
    <section id="why" className="mt-20 bg-ink py-20 text-white md:mt-28 md:py-28">
      <div className="container-nw">
        <div className="max-w-2xl">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-400">Why Near Wheels</p>
            <h2 className="section-title mt-2">More than a rental platform.</h2>
          </Reveal>
        </div>
        <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={i * 0.08}>
              <div className="border-t-2 border-brand-500/70 pt-6">
                <span className="font-display text-sm font-bold text-brand-400">0{i + 1}</span>
                <h3 className="mt-2 font-display text-2xl font-bold tracking-tight">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{b.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
