/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        enterprise: {
          50: "#f0f7ff",
          100: "#e0effe",
          200: "#b9ddfe",
          300: "#7cc2fd",
          400: "#36a3fa",
          500: "#0c87eb",
          600: "#006ac8",
          700: "#0154a3",
          800: "#064786",
          900: "#0b3c6f",
          950: "#07264a",
        },
      },
    },
  },
  plugins: [],
};

export default config;
