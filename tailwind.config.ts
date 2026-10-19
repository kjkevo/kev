import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    // Card/Badge/etc. live under src/components — without this glob, Tailwind's
    // JIT purges any class used only there (e.g. Badge's success/danger colors).
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      colors: {
        navy: {
          950: "#05080F",
          900: "#080D1A",
          800: "#0D1526",
          700: "#111D33",
          600: "#162440",
        },
        teal: {
          DEFAULT: "#00E5C4",
          400: "#33EBD0",
          300: "#66F0DC",
          200: "#99F5E8",
          100: "#CCFAF4",
          dim: "rgba(0,229,196,0.12)",
          glow: "rgba(0,229,196,0.25)",
        },
        gray: {
          50:  "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
        },
        white: "#FFFFFF",
      },
      backgroundImage: {
        "dot-grid": "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
        "dot-grid-teal": "radial-gradient(circle, rgba(0,229,196,0.08) 1px, transparent 1px)",
      },
      backgroundSize: {
        "dot-24": "24px 24px",
      },
      boxShadow: {
        teal: "0 0 24px rgba(0,229,196,0.2)",
        "teal-sm": "0 0 12px rgba(0,229,196,0.15)",
        "card-dark": "0 1px 3px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.04) inset",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4,0,0.6,1) infinite",
        "fade-up": "fadeUp 0.5s ease-out forwards",
        "fade-in": "fadeIn 0.4s ease-out forwards",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
