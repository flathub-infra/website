import "../styles/main.scss"
import i18n from "./i18next"
import { languages, getLanguageName } from "../src/localize"

function createLocales() {
  const locales = {}
  languages.forEach((lng) => {
    locales[lng] = getLanguageName(lng)
  })
  return locales
}

export const parameters = {
  actions: { argTypesRegex: "^on[A-Z].*" },
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
