/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class", '[data-theme="dark"]'],
  important: true,
  content: ["./pages/**/*.{js,ts,jsx,tsx}", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        flathubGray98: "rgb(var(--flathub-gray-98) / <alpha-value>)",
        flathubRaisinBlack: "rgb(var(--flathub-raisin-black) / <alpha-value>)",
        flathubWhite: "rgb(var(--flathub-white) / <alpha-value>)",
        flathubJet: "rgb(var(--flathub-jet) / <alpha-value>)",
        flathubGray92: "rgb(var(--flathub-gray-92) / <alpha-value>)",
        flathubOuterSpace: "rgb(var(--flathub-outer-space) / <alpha-value>)",
        flathubGunmetal: "rgb(var(--flathub-gunmetal) / <alpha-value>)",
        flathubNickel: "rgb(var(--flathub-nickel) / <alpha-value>)",
        flathubDarkGray: "rgb(var(--flathub-dark-gray) / <alpha-value>)",
        flathubCyanBlueAzure:
          "rgb(var(--flathub-cyan-blue-azure) / <alpha-value>)",
        flathubIndigo: "rgb(var(--flathub-indigo) / <alpha-value>)",
        flathubElectricRed: "rgb(var(--flathub-electric-red) / <alpha-value>)",
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
