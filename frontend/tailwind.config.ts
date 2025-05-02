export default {
  darkMode: ["selector"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./@/components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
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
    "bg-flathub-sonic-silver",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        "flathub-celestial-blue":
          "oklch(var(--flathub-celestial-blue) / <alpha-value>)",
        "flathub-celestial-blue-dark":
          "oklch(var(--flathub-celestial-blue-dark) / <alpha-value>)",
        "flathub-electric-red":
          "oklch(var(--flathub-electric-red) / <alpha-value>)",

        "flathub-status-green":
          "oklch(var(--flathub-status-green) / <alpha-value>)",
        "flathub-status-green-dark":
          "oklch(var(--flathub-status-green-dark) / <alpha-value>)",
        "flathub-status-yellow":
          "oklch(var(--flathub-status-yellow) / <alpha-value>)",
        "flathub-status-yellow-dark":
          "oklch(var(--flathub-status-yellow-dark) / <alpha-value>)",
        "flathub-status-orange":
          "oklch(var(--flathub-status-orange) / <alpha-value>)",
        "flathub-status-orange-dark":
          "oklch(var(--flathub-status-orange-dark) / <alpha-value>)",
        "flathub-status-red":
          "oklch(var(--flathub-status-red) / <alpha-value>)",
        "flathub-status-red-dark":
          "oklch(var(--flathub-status-red-dark) / <alpha-value>)",

        "flathub-white": "oklch(var(--flathub-white) / <alpha-value>)",
        "flathub-lotion": "oklch(var(--flathub-lotion) / <alpha-value>)",
        "flathub-gainsborow":
          "oklch(var(--flathub-gainsborow) / <alpha-value>)",
        "flathub-gray-x11": "oklch(var(--flathub-gray-x11) / <alpha-value>)",
        "flathub-spanish-gray":
          "oklch(var(--flathub-spanish-gray) / <alpha-value>)",
        "flathub-sonic-silver":
          "oklch(var(--flathub-sonic-silver) / <alpha-value>)",
        "flathub-granite-gray":
          "oklch(var(--flathub-granite-gray) / <alpha-value>)",
        "flathub-arsenic": "oklch(var(--flathub-arsenic) / <alpha-value>)",
        "flathub-dark-gunmetal":
          "oklch(var(--flathub-dark-gunmetal) / <alpha-value>)",
        "flathub-black": "oklch(var(--flathub-black) / <alpha-value>)",

        "flathub-vivid-crimson":
          "oklch(var(--flathub-vivid-crimson) / <alpha-value>)",
        "flathub-dark-candy-apple-red":
          "oklch(var(--flathub-dark-candy-apple-red) / <alpha-value>)",

        border: "oklch(var(--border))",
        input: "oklch(var(--input))",
        ring: "oklch(var(--ring))",
        background: "oklch(var(--background))",
        foreground: "oklch(var(--foreground))",
        primary: {
          DEFAULT: "oklch(var(--primary))",
          foreground: "oklch(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "oklch(var(--secondary))",
          foreground: "oklch(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "oklch(var(--destructive))",
          foreground: "oklch(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "oklch(var(--muted))",
          foreground: "oklch(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "oklch(var(--accent))",
          foreground: "oklch(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "oklch(var(--popover))",
          foreground: "oklch(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "oklch(var(--card))",
          foreground: "oklch(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
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
  plugins: [require("@tailwindcss/typography"), require("tailwindcss-animate")],
}
