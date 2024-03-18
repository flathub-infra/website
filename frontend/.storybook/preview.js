import "../styles/main.scss"
import i18n from "./i18next"
import { languages, getLanguageName } from "../src/localize"
import { withThemeByDataAttribute } from "@storybook/addon-themes"

function createLocales() {
  const locales = {}
  languages.forEach((lng) => {
    locales[lng] = getLanguageName(lng)
  })
  return locales
}

export const parameters = {
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
  i18n,
  locale: "en",
  locales: createLocales(),
}

export default {
  decorators: [
    withThemeByDataAttribute({
      themes: {
        light: "light",
        dark: "dark",
      },
      defaultTheme: "dark",
    }),
  ],
}
