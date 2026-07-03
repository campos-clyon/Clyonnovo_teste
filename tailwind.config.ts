import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: false,
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#00B4CC",
          50: "#E6F9FC",
          100: "#CCF3F9",
          200: "#99E7F3",
          300: "#66DBED",
          400: "#33CFE7",
          500: "#00B4CC",
          600: "#0090A3",
          700: "#006C7A",
          800: "#004852",
          900: "#002429",
        },
        cyan: {
          50: "#E0F7FA",
          100: "#B2EBF2",
          200: "#80DEEA",
          300: "#4DD0E1",
          400: "#26C6DA",
          500: "#00BCD4",
          600: "#00ACC1",
          700: "#0097A7",
          800: "#00838F",
          900: "#006064",
          DEFAULT: "#00B4CC",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
