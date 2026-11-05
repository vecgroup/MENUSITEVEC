/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./constants.tsx",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "sans-serif"],
      },
      colors: {
        'tim-blue': '#003399',
        'tim-cyan': '#00A1E4',
        'rockstar-yellow': '#00A1E4',
        'rockstar-black': '#001a4d',
        'rockstar-gray': '#002673',
      },
    },
  },
  plugins: [],
}
