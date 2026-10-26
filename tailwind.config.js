/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        air: "#E4590A",
        blood: "#A8200F",
        "blood-deep": "#8A1A0C",
        ink: "#1E0A0C",
        "ink-soft": "#341216",
        ivory: "#FFF4E8",
        cream: "#FBEBDD",
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', '"Helvetica Neue"', "Arial", "sans-serif"],
        sans: ['"Hanken Grotesk"', '"Helvetica Neue"', "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
