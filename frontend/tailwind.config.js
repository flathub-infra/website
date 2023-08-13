/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./pages/**/*.{js,ts,jsx,tsx}", "./src/**/*.{js,ts,jsx,tsx}"],
  safelist: [
    "text-flathub-status-green",
    "bg-flathub-status-green/25",
    "text-flathub-status-yellow",
    "bg-flathub-status-yellow/25",
    "text-flathub-status-red",
    "bg-flathub-status-red/25",
    "text-flathub-status-orange",
    "bg-flathub-status-orange/25",
    "text-flathub-status-green-dark",
    "bg-flathub-status-green-dark/25",
    "text-flathub-status-yellow-dark",
    "bg-flathub-status-yellow-dark/25",
    "text-flathub-status-red-dark",
    "bg-flathub-status-red-dark/25",
    "text-flathub-status-orange-dark",
    "bg-flathub-status-orange-dark/25",
  ],
  theme: {
    extend: {
      colors: {
        "flathub-celestial-blue":
          "rgb(var(--flathub-celestial-blue) / <alpha-value>)",
        "flathub-electric-red":
          "rgb(var(--flathub-electric-red) / <alpha-value>)",

        "flathub-status-green":
          "rgb(var(--flathub-status-green) / <alpha-value>)",
        "flathub-status-green-dark":
          "rgb(var(--flathub-status-green-dark) / <alpha-value>)",
        "flathub-status-yellow":
          "rgb(var(--flathub-status-yellow) / <alpha-value>)",
        "flathub-status-yellow-dark":
          "rgb(var(--flathub-status-yellow-dark) / <alpha-value>)",
        "flathub-status-orange":
          "rgb(var(--flathub-status-orange) / <alpha-value>)",
        "flathub-status-orange-dark":
          "rgb(var(--flathub-status-orange-dark) / <alpha-value>)",
        "flathub-status-red": "rgb(var(--flathub-status-red) / <alpha-value>)",
        "flathub-status-red-dark":
          "rgb(var(--flathub-status-red-dark) / <alpha-value>)",

        "flathub-white": "rgb(var(--flathub-white) / <alpha-value>)",
        "flathub-gainsborow": "rgb(var(--flathub-gainsborow) / <alpha-value>)",
        "flathub-gray-x11": "rgb(var(--flathub-gray-x11) / <alpha-value>)",
        "flathub-spanish-gray":
          "rgb(var(--flathub-spanish-gray) / <alpha-value>)",
        "flathub-sonic-silver":
          "rgb(var(--flathub-sonic-silver) / <alpha-value>)",
        "flathub-granite-gray":
          "rgb(var(--flathub-granite-gray) / <alpha-value>)",
        "flathub-arsenic": "rgb(var(--flathub-arsenic) / <alpha-value>)",
        "flathub-dark-gunmetal":
          "rgb(var(--flathub-dark-gunmetal) / <alpha-value>)",
        "flathub-black": "rgb(var(--flathub-black) / <alpha-value>)",
      },
      boxShadow: {
        md: "0 0 0 1px rgba(0, 0, 0, 0.03), 0 1px 3px 1px rgba(0, 0, 0, 0.07), 0 2px 6px 2px rgba(0, 0, 0, 0.03)",
        xl: "0 0 0 1px rgba(0, 0, 0, 0.03), 0 1px 6px 6px rgba(0, 0, 0, 0.07), 0 2px 6px 2px rgba(0, 0, 0, 0.03)",
      },
      gridTemplateColumns: {
        details: "auto 90% auto",
        details2xl: "auto 1400px auto",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
}
