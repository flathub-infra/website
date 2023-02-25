/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class", '[data-theme="dark"]'],
  important: true,
  content: ["./pages/**/*.{js,ts,jsx,tsx}", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "flathub-gainsborow": "rgb(var(--flathub-gainsborow) / <alpha-value>)",
        "flathub-dark-gunmetal":
          "rgb(var(--flathub-dark-gunmetal) / <alpha-value>)",
        "flathub-white": "rgb(var(--flathub-white) / <alpha-value>)",
        "flathub-arsenic": "rgb(var(--flathub-arsenic) / <alpha-value>)",
        "flathub-gray-x11": "rgb(var(--flathub-gray-x11) / <alpha-value>)",
        "flathub-granite-gray":
          "rgb(var(--flathub-granite-gray) / <alpha-value>)",
        "flathub-dark-gunmetal":
          "rgb(var(--flathub-dark-gunmetal) / <alpha-value>)",
        "flathub-sonic-silver":
          "rgb(var(--flathub-sonic-silver) / <alpha-value>)",
        "flathub-spanish-gray":
          "rgb(var(--flathub-spanish-gray) / <alpha-value>)",
        "flathub-celestial-blue":
          "rgb(var(--flathub-celestial-blue) / <alpha-value>)",
        "flathub-black": "rgb(var(--flathub-black) / <alpha-value>)",
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
