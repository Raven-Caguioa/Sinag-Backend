/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#ffffff", // light background
        foreground: "#111827", // text
        border: "#d1d5db",     // gray-300
        primary: "#D4AF37",    // gold
        "primary-foreground": "#ffffff",
      },
    },
  },
  plugins: [],
};