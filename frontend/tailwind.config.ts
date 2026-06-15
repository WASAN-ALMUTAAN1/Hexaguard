import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#030407", // Deepest space black
          panel: "#1f2122",   // Card backgrounds
          surface: "#27292a", // Elevated surfaces
        },
        accent: {
          cyan: "#4ad7ff",
          violet: "#9d7cff",
        },
        risk: {
          critical: "#ff3434",
          high: "#ffb347",
          medium: "#f2c94c",
          low: "#30d158",
        },
        text: {
          DEFAULT: "#ffffff",
          muted: "#a9a9a9",
          dim: "#727272",
        },
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;