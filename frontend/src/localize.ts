import {
  de,
  enUS,
  enGB,
  tr,
  fr,
  nb,
  fi,
  id,
  pl,
  pt,
  it,
  ru,
  vi,
  ar,
  es,
  ja,
  cs,
  zhCN,
  bg,
  uk,
  et,
  ca,
  el,
} from "date-fns/locale"

export type Language =
  | "en"
  | "en_GB"
  | "de"
  | "fr"
  | "nb_NO"
  | "tr"
  | "fi"
  | "id"
  | "pl"
  | "pt_BR"
  | "it"
  | "ru"
  | "si"
  | "vi"
  | "ar"
  | "es"
  | "ja"
  | "cs"
  | "zh_Hans"
  | "bg"
  | "uk"
  | "et"
  | "ca"
  | "el"

export const languages: Language[] = [
  "en",
  "en_GB",
  "de",
  "fr",
  "nb_NO",
  "tr",
  "fi",
  "id",
  "pl",
  "pt_BR",
  "it",
  "ru",
  "si",
  "vi",
  "ar",
  "es",
  "ja",
  "cs",
  "zh_Hans",
  "bg",
  "uk",
  "et",
  "ca",
  "el",
]

export function getLocale(language: string): Locale {
  switch (language) {
    case "en":
    case "en_US":
      return enUS
    case "en_GB":
      return enGB
    case "de":
      return de
    case "fr":
      return fr
    case "nb_NO":
      return nb
    case "tr":
      return tr
    case "fi":
      return fi
    case "id":
      return id
    case "it":
      return it
    case "pl":
      return pl
    case "pt_BR":
      return pt
    case "ru":
      return ru
    case "si":
      return enUS // date-fns has no Sinhala locale
    case "vi":
      return vi
    case "ar":
      return ar
    case "es":
      return es
    case "ja":
      return ja
    case "cs":
      return cs
    case "zh_Hans":
      return zhCN
    case "bg":
      return bg
    case "uk":
      return uk
    case "et":
      return et
    case "ca":
      return ca
    case "el":
      return el

    default:
      return enGB
  }
}

export function getLocaleString(language: string): string {
  switch (language) {
    case "en":
    case "en_US":
      return "en_US"
    case "de":
      return "de_DE"
    case "en_GB":
      return "en_GB"
    case "fr":
      return "fr_FR"
    case "nb_NO":
      return "nb_NO"
    case "tr":
      return "tr_TR"
    case "fi":
      return "fi_FI"
    case "id":
      return "id_ID"
    case "it":
      return "it_IT"
    case "pl":
      return "pl_PL"
    case "pt_BR":
      return "pt_BR"
    case "ru":
      return "ru_RU"
    case "si":
      return "si_LK"
    case "vi":
      return "vi_VN"
    case "ar":
      return "ar_AE"
    case "es":
      return "es_ES"
    case "ja":
      return "ja_JP"
    case "cs":
      return "cs_CZ"
    case "zh_Hans":
      return "zh_Hans"
    case "bg":
      return "bg_BG"
    case "uk":
      return "uk_UA"
    case "et":
      return "et_EE"
    case "ca":
      return "ca_ES"
    case "el":
      return "el_GR"

    default:
      return "en_US"
  }
}

export function getLanguageFlag(language: Language): string {
  switch (language) {
    case "de":
      return "🇩🇪"
    case "en":
      return "🇺🇸"
    case "en_GB":
      return "🇬🇧"
    case "fr":
      return "🇫🇷"
    case "nb_NO":
      return "🇳🇴"
    case "tr":
      return "🇹🇷"
    case "fi":
      return "🇫🇮"
    case "id":
      return "🇮🇩"
    case "it":
      return "🇮🇹"
    case "pl":
      return "🇵🇱"
    case "pt_BR":
      return "🇧🇷"
    case "ru":
      return "🇷🇺"
    case "si":
      return "🇸🇮"
    case "vi":
      return "🇻🇳"
    case "ar":
      return "🇸🇦"
    case "es":
      return "🇪🇸"
    case "ja":
      return "🇯🇵"
    case "cs":
      return "🇨🇿"
    case "zh_Hans":
      return "🇨🇳"
    case "bg":
      return "🇧🇬"
    case "uk":
      return "🇺🇦"
    case "et":
      return "🇪🇪"
    case "ca":
      return ""
    case "el":
      return "🇬🇷"
  }
}

export function getLanguageName(language: Language): string {
  switch (language) {
    case "en":
      return "English"
    case "en_GB":
      return "English (UK)"
    case "de":
      return "Deutsch"
    case "fr":
      return "Français"
    case "nb_NO":
      return "Norsk"
    case "tr":
      return "Türkçe"
    case "fi":
      return "Suomi"
    case "id":
      return "Bahasa Indonesia"
    case "it":
      return "Italiano"
    case "pl":
      return "Polski"
    case "pt_BR":
      return "Brasileiro"
    case "ru":
      return "Русский язык"
    case "si":
      return "සිංහල"
    case "vi":
      return "Tiếng Việt"
    case "ar":
      return "العربية"
    case "es":
      return "Español"
    case "ja":
      return "日本語"
    case "cs":
      return "Čeština"
    case "zh_Hans":
      return "简体中文"
    case "bg":
      return "Български"
    case "uk":
      return "Українська"
    case "et":
      return "Eesti"
    case "ca":
      return "Català"
    case "el":
      return "Ελληνικά"

    default:
      return assertUnreachable(language)
  }
}

export function getIntlLocale(language: string): Intl.Locale {
  switch (language) {
    case "en":
    case "en_US":
      return new Intl.Locale("en", {
        region: "US",
      })
    case "de":
      return new Intl.Locale("de")
    case "en_GB":
      return new Intl.Locale("en", {
        region: "GB",
      })
    case "fr":
      return new Intl.Locale("fr")
    case "nb_NO":
      return new Intl.Locale("nb", {
        region: "NO",
      })
    case "tr":
      return new Intl.Locale("tr")
    case "fi":
      return new Intl.Locale("fi")
    case "id":
      return new Intl.Locale("id")
    case "it":
      return new Intl.Locale("it")
    case "pl":
      return new Intl.Locale("pl")
    case "pt_BR":
      return new Intl.Locale("pt", {
        region: "BR",
      })
    case "ru":
      return new Intl.Locale("ru")
    case "si":
      return new Intl.Locale("si")
    case "vi":
      return new Intl.Locale("vi")
    case "ar":
      return new Intl.Locale("ar", {
        region: "AE",
      })
    case "es":
      return new Intl.Locale("es")
    case "ja":
      return new Intl.Locale("ja")
    case "cs":
      return new Intl.Locale("cs")
    case "zh_Hans":
      return new Intl.Locale("zh", {
        script: "Hans",
      })
    case "bg":
      return new Intl.Locale("bg")
    case "uk":
      return new Intl.Locale("uk")
    case "et":
      return new Intl.Locale("et")
    case "ca":
      return new Intl.Locale("ca")
    case "el":
      return new Intl.Locale("el")
  }
}

function assertUnreachable(_x: never): never {
  throw new Error("Didn't expect to get here")
}
