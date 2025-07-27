import { initReactI18next } from "react-i18next"
import i18n from "i18next"
import { languages } from "../src/localize"

const ns = ["common"]
const supportedLngs = languages
const resources = ns.reduce((acc, n) => {
  supportedLngs.forEach(async (lng) => {
    if (!acc[lng]) acc[lng] = {}
    acc[lng] = {
      ...acc[lng],
      [n]: await import(`../public/locales/${lng}/${n}.json`).then(
        (mod) => mod.default,
      ),
    }
  })
  return acc
}, {})

i18n.use(initReactI18next).init({
  debug: true,
  lng: "en",
  fallbackLng: "en",
  defaultNS: "common",
  ns,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
  supportedLngs,
  resources,
})

export default i18n
