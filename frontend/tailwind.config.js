/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class", '[data-theme="dark"]'],
  important: true,
  content: ["./pages/**/*.{js,ts,jsx,tsx}", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "flathub-gray-98": "rgb(var(--flathub-gray-98) / <alpha-value>)",
        "flathub-raisin-black":
          "rgb(var(--flathub-raisin-black) / <alpha-value>)",
        "flathub-white": "rgb(var(--flathub-white) / <alpha-value>)",
        "flathub-jet": "rgb(var(--flathub-jet) / <alpha-value>)",
        "flathub-gray-92": "rgb(var(--flathub-gray-92) / <alpha-value>)",
        "flathub-outer-space":
          "rgb(var(--flathub-outer-space) / <alpha-value>)",
        "flathub-gunmetal": "rgb(var(--flathub-gunmetal) / <alpha-value>)",
        "flathub-nickel": "rgb(var(--flathub-nickel) / <alpha-value>)",
        "flathub-dark-gray": "rgb(var(--flathub-dark-gray) / <alpha-value>)",
        "flathub-cyan-blue-azure":
          "rgb(var(--flathub-cyan-blue-azure) / <alpha-value>)",
        "flathub-indigo": "rgb(var(--flathub-indigo) / <alpha-value>)",
        "flathub-electric-red":
          "rgb(var(--flathub-electric-red) / <alpha-value>)",
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
  plugins: [
    require("@tailwindcss/typography"),
    require("@tailwindcss/line-clamp"),
  ],
}
