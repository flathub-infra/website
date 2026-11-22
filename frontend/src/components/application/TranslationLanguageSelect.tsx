import { useLocale } from "next-intl"
import type { ComponentProps } from "react"
import { getLanguageName } from "src/localize"
import { translationLanguages } from "./translationLanguages"

export default function TranslationLanguageSelect(
  props: ComponentProps<"select">,
) {
  const locale = useLocale()
  return (
    <select
      className="min-h-10 min-w-0 flex-1 rounded-md border bg-card px-3 text-foreground"
      required
      {...props}
    >
      <option value="" disabled>
        Select a language
      </option>
      {translationLanguages
        .toSorted((a, b) =>
          getLanguageName(a).localeCompare(getLanguageName(b), locale),
        )
        .map((language) => (
          <option key={language} value={language}>
            {getLanguageName(language)}
          </option>
        ))}
    </select>
  )
}
