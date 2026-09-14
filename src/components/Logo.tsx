const MARK = (
  <>
    <rect width="48" height="48" rx="13" fill="#111111" />
    {/* motion dashes */}
    <rect x="5.5" y="18.5" width="6" height="3" rx="1.5" fill="#FF6A00" opacity="0.45" />
    <rect x="7.5" y="26.5" width="4" height="3" rx="1.5" fill="#FF6A00" opacity="0.25" />
    {/* wheel */}
    <circle cx="28" cy="24" r="11.5" stroke="#FFFFFF" strokeWidth="3.2" />
    <path
      d="M28 20.8 V12.8 M25.2 25.6 L18.4 29.5 M30.8 25.6 L37.6 29.5"
      stroke="#FFFFFF"
      strokeWidth="3.2"
      strokeLinecap="round"
    />
    <circle cx="28" cy="24" r="3.4" fill="#FF6A00" />
  </>
);

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" role="img" aria-label="Near Wheels">
      {MARK}
    </svg>
  );
}

export default function Logo({
  size = 34,
  dark = false,
  wordmark = true,
}: {
  size?: number;
  dark?: boolean;
  wordmark?: boolean;
}) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} />
      {wordmark && (
        <span
          className={`font-display text-lg font-extrabold leading-none tracking-[0.14em] ${
            dark ? "text-white" : "text-ink"
          }`}
        >
          NEAR<span className="text-brand-500">WHEELS</span>
        </span>
      )}
    </span>
  );
}
