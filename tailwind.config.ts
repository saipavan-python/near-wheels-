import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#FFF4EC",
          100: "#FFE6D3",
          200: "#FFC8A6",
          300: "#FFA26F",
          400: "#FF8036",
          500: "#FF6A00",
          600: "#EF5F00",
          700: "#C64E00",
          800: "#9C3E00",
          900: "#742E00",
        },
        ink: {
          DEFAULT: "#111111",
          soft: "#242424",
          mute: "#77736D",
          faint: "#B7B5AF",
        },
        paper: {
          DEFAULT: "#F7F6F2",
          deep: "#E9E7E2",
        },
        accent: "#FF6A00",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["Manrope", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(17,17,17,.05), 0 6px 20px rgba(17,17,17,.07)",
        lift: "0 4px 10px rgba(17,17,17,.08), 0 18px 40px rgba(17,17,17,.12)",
        panel: "0 -8px 40px rgba(17,17,17,.16)",
      },
      keyframes: {
        "hero-zoom": {
          from: { transform: "scale(1.0)" },
          to: { transform: "scale(1.07)" },
        },
      },
      animation: {
        "hero-zoom": "hero-zoom 14s cubic-bezier(.22,1,.36,1) forwards",
      },
    },
  },
  plugins: [],
};
export default config;
