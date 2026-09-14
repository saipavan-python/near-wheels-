/** Small inline SVG icon set — no external dependencies. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="24" cy="24" r="21" stroke="#047857" strokeWidth="4" />
      <circle cx="24" cy="24" r="5" fill="#059669" />
      <path d="M24 19V4M28.2 25.8l12.6 7.3M19.8 25.8L7.2 33.1" stroke="#059669" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

type P = { className?: string };
const base = "h-5 w-5";

export const IconCar = ({ className = base }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 11l1.5-4.5A2 2 0 018.4 5h7.2a2 2 0 011.9 1.5L19 11m-14 0h14a2 2 0 012 2v4a1 1 0 01-1 1h-1a2 2 0 11-4 0H9a2 2 0 11-4 0H4a1 1 0 01-1-1v-4a2 2 0 012-2z"/></svg>
);
export const IconAuto = ({ className = base }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M9 17h6M6 14V7l6-2v12"/><path d="M12 9l4 2v6"/></svg>
);
export const IconBike = ({ className = base }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17l4-8h4l-2 4h4l-2-6h2"/></svg>
);
export const IconTruck = ({ className = base }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 7h11v9H2zM13 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg>
);
export const IconTractor = ({ className = base }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="7" cy="16" r="4"/><circle cx="18" cy="17" r="2.6"/><path d="M7 12V5h4l1 3h4v4"/><path d="M12 8h5"/></svg>
);
export const IconDrone = ({ className = base }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="9" width="6" height="6" rx="1.5"/><path d="M9 9L5 5M15 9l4-4M9 15l-4 4M15 15l4 4"/><path d="M3.5 3.5h3M17.5 3.5h3M3.5 20.5h3M17.5 20.5h3"/></svg>
);
export const IconWrench = ({ className = base }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14.7 6.3a4.5 4.5 0 00-6 5.6L3 17.6V21h3.4l5.7-5.7a4.5 4.5 0 005.6-6L14.5 12l-2.5-2.5 2.7-3.2z"/></svg>
);
export const IconDriver = ({ className = base }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 20c1.2-3.4 4-5 7.5-5s6.3 1.6 7.5 5"/></svg>
);
export const IconSiren = ({ className = base }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 15a5 5 0 0110 0v3H7v-3z"/><path d="M12 4v2M5 8l1.4 1.4M19 8l-1.4 1.4M4 21h16"/></svg>
);
export const IconMic = ({ className = base }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>
);
export const IconPin = ({ className = base }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 21s-6.5-5.3-6.5-10a6.5 6.5 0 1113 0C18.5 15.7 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/></svg>
);
export const IconStar = ({ className = base }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.9L12 3.5z"/></svg>
);
export const IconShield = ({ className = base }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4.5"/></svg>
);
export const IconClock = ({ className = base }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>
);
export const IconChat = ({ className = base }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6a3 3 0 013-3h10a3 3 0 013 3v7a3 3 0 01-3 3H9l-5 4V6z"/></svg>
);
export const IconX = ({ className = base }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
);
export const IconSend = ({ className = base }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12l16-8-6 8 6 8-16-8z"/></svg>
);
export const IconCheck = ({ className = base }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4.5 12.5l5 5 10-11"/></svg>
);
export const IconAlert = ({ className = base }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4.5M12 18.2v.3"/></svg>
);
export const IconRupee = ({ className = base }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 4h10M7 9h10M15 4c0 4-3 5-8 5 4 0 6 1 9 6M7 20l7-8"/></svg>
);
