import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "media",
  theme: {
    extend: {
      fontFamily: {
        sans: ["-apple-system", "SF Hebrew", "system-ui", "Segoe UI", "Assistant", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
