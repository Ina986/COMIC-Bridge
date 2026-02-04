/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#0d0d1a",
          secondary: "#141428",
          tertiary: "#1a1a36",
          elevated: "#1e1e3d",
        },
        text: {
          primary: "#f0f0f5",
          secondary: "#9898b8",
          muted: "#5c5c7a",
        },
        accent: {
          DEFAULT: "#5c9cff",
          hover: "#7eb4ff",
          glow: "rgba(92, 156, 255, 0.25)",
        },
        success: "#34d399",
        warning: "#fbbf24",
        error: "#f87171",
        guide: {
          h: "#ff6b6b",
          v: "#4ecdc4",
        },
      },
      fontFamily: {
        sans: ['"Segoe UI"', '"Yu Gothic UI"', '"Meiryo"', "sans-serif"],
        mono: ["Consolas", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
