import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lms: {
          // Dag-farver brugt til skole-markører pÃ¥ kortet
          day1: "#e11d48",
          day2: "#f59e0b",
          day3: "#10b981",
          day4: "#3b82f6",
          day5: "#8b5cf6",
          day6: "#ec4899",
          day7: "#14b8a6",
          day8: "#f97316",
          day9: "#6366f1",
          day10: "#06b6d4",
        },
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
