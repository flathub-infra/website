import "../styles/main.css"
import { getLanguageName, getLanguageFlag } from "../src/localize"
import { withThemeByClassName } from "@storybook/addon-themes"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { faker } from "@faker-js/faker"
import { MotionGlobalConfig } from "framer-motion"
import isChromatic from "chromatic/isChromatic"

import { initialize, mswLoader } from "msw-storybook-addon"
import { allModes } from "./modes"
import nextIntl from "./next-intl"

initialize()

MotionGlobalConfig.skipAnimations = isChromatic()

// Use a fixed seed, so that the faker data doesn't change
// Important for chromatic change detection
faker.seed(42)
faker.setDefaultRefDate(new Date(2024, 0, 1))

const queryClient = new QueryClient()

export default {
  initialGlobals: {
    locale: "en",
    locales: {
      en: {
        title: getLanguageName("en"),
        icon: getLanguageFlag("en"),
        right: "en",
      },
      de: {
        title: getLanguageName("de"),
        icon: getLanguageFlag("de"),
        right: "de",
      },
      fr: {
        title: getLanguageName("fr"),
        icon: getLanguageFlag("fr"),
        right: "fr",
      },
      tr: {
        title: getLanguageName("tr"),
        icon: getLanguageFlag("tr"),
        right: "tr",
      },
      fi: {
        title: getLanguageName("fi"),
        icon: getLanguageFlag("fi"),
        right: "fi",
      },
      id: {
        title: getLanguageName("id"),
        icon: getLanguageFlag("id"),
        right: "id",
      },
      pl: {
        title: getLanguageName("pl"),
        icon: getLanguageFlag("pl"),
        right: "pl",
      },
      it: {
        title: getLanguageName("it"),
        icon: getLanguageFlag("it"),
        right: "it",
      },
      ru: {
        title: getLanguageName("ru"),
        icon: getLanguageFlag("ru"),
        right: "ru",
      },
      si: {
        title: getLanguageName("si"),
        icon: getLanguageFlag("si"),
        right: "si",
      },
      vi: {
        title: getLanguageName("vi"),
        icon: getLanguageFlag("vi"),
        right: "vi",
      },
      ar: {
        title: getLanguageName("ar"),
        icon: getLanguageFlag("ar"),
        right: "ar",
      },
      es: {
        title: getLanguageName("es"),
        icon: getLanguageFlag("es"),
        right: "es",
      },
      ja: {
        title: getLanguageName("ja"),
        icon: getLanguageFlag("ja"),
        right: "ja",
      },
      cs: {
        title: getLanguageName("cs"),
        icon: getLanguageFlag("cs"),
        right: "cs",
      },
      uk: {
        title: getLanguageName("uk"),
        icon: getLanguageFlag("uk"),
        right: "uk",
      },
      et: {
        title: getLanguageName("et"),
        icon: getLanguageFlag("et"),
        right: "et",
      },
      ca: {
        title: getLanguageName("ca"),
        icon: getLanguageFlag("ca"),
        right: "ca",
      },
      el: {
        title: getLanguageName("el"),
        icon: getLanguageFlag("el"),
        right: "el",
      },
      ta: {
        title: getLanguageName("ta"),
        icon: getLanguageFlag("ta"),
        right: "ta",
      },
      fa: {
        title: getLanguageName("fa"),
        icon: getLanguageFlag("fa"),
        right: "fa",
      },
      hi: {
        title: getLanguageName("hi"),
        icon: getLanguageFlag("hi"),
        right: "hi",
      },
      bn: {
        title: getLanguageName("bn"),
        icon: getLanguageFlag("bn"),
        right: "bn",
      },
      eo: {
        title: getLanguageName("eo"),
        icon: getLanguageFlag("eo"),
        right: "eo",
      },
      lt: {
        title: getLanguageName("lt"),
        icon: getLanguageFlag("lt"),
        right: "lt",
      },
      hr: {
        title: getLanguageName("hr"),
        icon: getLanguageFlag("hr"),
        right: "hr",
      },
      be: {
        title: getLanguageName("be"),
        icon: getLanguageFlag("be"),
        right: "be",
      },
      hu: {
        title: getLanguageName("hu"),
        icon: getLanguageFlag("hu"),
        right: "hu",
      },
      nl: {
        title: getLanguageName("nl"),
        icon: getLanguageFlag("nl"),
        right: "nl",
      },
      pt: {
        title: getLanguageName("pt"),
        icon: getLanguageFlag("pt"),
        right: "pt",
      },
      oc: {
        title: getLanguageName("oc"),
        icon: getLanguageFlag("oc"),
        right: "oc",
      },
      da: {
        title: getLanguageName("da"),
        icon: getLanguageFlag("da"),
        right: "da",
      },
      az: {
        title: getLanguageName("az"),
        icon: getLanguageFlag("az"),
        right: "az",
      },
      he: {
        title: getLanguageName("he"),
        icon: getLanguageFlag("he"),
        right: "he",
      },
      ro: {
        title: getLanguageName("ro"),
        icon: getLanguageFlag("ro"),
        right: "ro",
      },
      hy: {
        title: getLanguageName("hy"),
        icon: getLanguageFlag("hy"),
        right: "hy",
      },
      ko: {
        title: getLanguageName("ko"),
        icon: getLanguageFlag("ko"),
        right: "ko",
      },
      sv: {
        title: getLanguageName("sv"),
        icon: getLanguageFlag("sv"),
        right: "sv",
      },
      pa: {
        title: getLanguageName("pa"),
        icon: getLanguageFlag("pa"),
        right: "pa",
      },
      sq: {
        title: getLanguageName("sq"),
        icon: getLanguageFlag("sq"),
        right: "sq",
      },
      ia: {
        title: getLanguageName("ia"),
        icon: getLanguageFlag("ia"),
        right: "ia",
      },
      ckb: {
        title: getLanguageName("ckb"),
        icon: getLanguageFlag("ckb"),
        right: "ckb",
      },
      ga: {
        title: getLanguageName("ga"),
        icon: getLanguageFlag("ga"),
        right: "ga",
      },
      kab: {
        title: getLanguageName("kab"),
        icon: getLanguageFlag("kab"),
        right: "kab",
      },
      fil: {
        title: getLanguageName("fil"),
        icon: getLanguageFlag("fil"),
        right: "fil",
      },
      br: {
        title: getLanguageName("br"),
        icon: getLanguageFlag("br"),
        right: "br",
      },
      en_GB: {
        title: getLanguageName("en-GB"),
        icon: getLanguageFlag("en-GB"),
        right: "en-GB",
      },
      nb_NO: {
        title: getLanguageName("nb-NO"),
        icon: getLanguageFlag("nb-NO"),
        right: "nb-NO",
      },
      pt_BR: {
        title: getLanguageName("pt-BR"),
        icon: getLanguageFlag("pt-BR"),
        right: "pt-BR",
      },
      bg: {
        title: getLanguageName("bg"),
        icon: getLanguageFlag("bg"),
        right: "bg",
      },
      zh_Hans: {
        title: getLanguageName("zh-Hans"),
        icon: getLanguageFlag("zh-Hans"),
        right: "zh-Hans",
      },
      zh_Hant: {
        title: getLanguageName("zh-Hant"),
        icon: getLanguageFlag("zh-Hant"),
        right: "zh-Hant",
      },
      gl: {
        title: getLanguageName("gl"),
        icon: getLanguageFlag("gl"),
        right: "gl",
      },
    },
  },
  parameters: {
    nextIntl,
    mockingDate: new Date(2024, 0, 1),
    viewport: {
      viewports: {
        small: { name: "Small", styles: { width: "640px", height: "800px" } },
        large: { name: "Large", styles: { width: "1024px", height: "1000px" } },
      },
    },
    backgrounds: {
      values: [
        { name: "light", value: "#fafafa" },
        { name: "dark", value: "#251f32" },
      ],
    },
    chromatic: {
      modes: {
        dark: allModes["dark"],
      },
    },
  },
  loaders: [mswLoader],
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>{Story()}</QueryClientProvider>
    ),
    withThemeByClassName({
      themes: {
        light: "light",
        dark: "dark",
      },
      defaultTheme: "dark",
    }),
  ],
  tags: ["autodocs"],
}
