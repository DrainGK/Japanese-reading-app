import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Background palettes
        base: "#FAFAF8",
        surface: "#FFFFFF",
        muted: "#F4F3F0",
        hover: "#EFEDE8",

        // Text colors
        "prose": "#1A1916",
        "prose-secondary": "#6B6860",
        "prose-muted": "#A09D97",
        "prose-inverse": "#FFFFFF",

        // Border colors
        "stroke-subtle": "#E8E6E1",
        "stroke-default": "#D4D1CA",
        "stroke-strong": "#B8B5AE",

        // Primary color palette - Soft violet
        primary: {
          50: "#F0EFFE",
          100: "#DDD9FC",
          200: "#C0B9F9",
          300: "#9E94F5",
          400: "#7C6FF0",
          500: "#6257E8",
          600: "#4D42D6",
          700: "#3A30B8",
          800: "#2A2289",
          900: "#1C175C",
        },

        // Success - Soft sage green
        success: {
          50: "#EDFAF4",
          100: "#C6F0DC",
          400: "#34B87A",
          500: "#27A06A",
          600: "#1D8558",
        },

        // Warning - Warm amber
        warning: {
          50: "#FFF8EB",
          100: "#FDECC8",
          400: "#F5A623",
          500: "#E09210",
          600: "#C07B08",
        },

        // Danger - Soft coral
        danger: {
          50: "#FFF0EE",
          100: "#FFD5CF",
          400: "#F06448",
          500: "#E04D30",
          600: "#C73A1E",
        },

        // Kanji highlight
        "kanji-bg": "#EDFAF4",
        "kanji-text": "#1D8558",
        "kanji-border": "#C6F0DC",

        // Vocabulary highlight
        "vocab-bg": "#EEF4FF",
        "vocab-text": "#2D5FC4",
        "vocab-border": "#C3D5FA",
      },

      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "sans-serif"],
        jp: ["'Noto Sans JP'", "sans-serif"],
      },

      fontSize: {
        "2xs": ["11px", { lineHeight: "16px" }],
        xs: ["12px", { lineHeight: "18px" }],
        sm: ["13px", { lineHeight: "20px" }],
        base: ["15px", { lineHeight: "24px" }],
        lg: ["17px", { lineHeight: "26px" }],
        xl: ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["30px", { lineHeight: "38px" }],
        "4xl": ["38px", { lineHeight: "46px" }],
      },

      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "18px",
        "2xl": "24px",
        full: "9999px",
      },

      boxShadow: {
        xs: "0 1px 2px 0 rgba(26,25,22,0.05)",
        sm: "0 2px 6px 0 rgba(26,25,22,0.07)",
        md: "0 4px 16px 0 rgba(26,25,22,0.08)",
        lg: "0 8px 32px 0 rgba(26,25,22,0.10)",
        primary: "0 4px 16px 0 rgba(98,87,232,0.25)",
      },

      transitionTimingFunction: {
        "bounce-soft": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
