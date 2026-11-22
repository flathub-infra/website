import { languages, type Language } from "src/localize"

export const translationLanguages = languages.filter((code) => code !== "en")

export function isTranslationLanguage(code: unknown): code is Language {
  return translationLanguages.some((language) => language === code)
}

export function resolveTranslationLanguage(code: unknown) {
  const normalized =
    typeof code === "string" ? code.replaceAll("_", "-").toLowerCase() : ""
  return translationLanguages.find(
    (language) => language.toLowerCase() === normalized,
  )
}
