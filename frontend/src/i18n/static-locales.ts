import { Language, languages } from "src/localize"
import { routing } from "./routing"

const fallbackLocale: Language =
  (languages.find((locale) => locale === routing.defaultLocale) as Language) ??
  languages[0]

function resolveStaticLocales(): Language[] {
  const rawValue = process.env.NEXT_STATIC_LOCALES

  if (!rawValue) {
    return [fallbackLocale]
  }

  const normalizedValue = rawValue.trim().toLowerCase()
  if (normalizedValue === "all") {
    return languages
  }

  const parsed = rawValue
    .split(",")
    .map((locale) => locale.trim())
    .filter((locale) => locale.length > 0)

  if (parsed.length === 0) {
    return [fallbackLocale]
  }

  const validLocales = parsed.filter((locale): locale is Language =>
    (languages as readonly string[]).includes(locale),
  )

  if (validLocales.length === 0) {
    return [fallbackLocale]
  }

  return validLocales
}

export const staticLocales: Language[] = resolveStaticLocales()
