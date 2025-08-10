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
  ta,
  faIR,
  hi,
  bn,
  eo,
  lt,
  hr,
  be,
  hu,
  nl,
  oc,
  da,
  az,
  he,
  ro,
  hy,
  ko,
  sv,
  sq,
  Locale,
  ckb,
  ptBR,
} from "date-fns/locale"

export type Language =
  | "en"
  | "en-GB"
  | "de"
  | "fr"
  | "nb-NO"
  | "tr"
  | "fi"
  | "id"
  | "pl"
  | "pt-BR"
  | "it"
  | "ru"
  | "si"
  | "vi"
  | "ar"
  | "es"
  | "ja"
  | "cs"
  | "zh-Hans"
  | "bg"
  | "uk"
  | "et"
  | "ca"
  | "el"
  | "ta"
  | "fa"
  | "hi"
  | "bn"
  | "eo"
  | "lt"
  | "hr"
  | "be"
  | "hu"
  | "nl"
  | "pt"
  | "zh-Hant"
  | "oc"
  | "da"
  | "az"
  | "he"
  | "ro"
  | "hy"
  | "ko"
  | "sv"
  | "pa"
  | "sq"
  | "ia"
  | "ckb"
  | "ga"
  | "kab"
  | "fil"
  | "br"

export const languages: Language[] = [
  "en",
  "en-GB",
  "de",
  "fr",
  "nb-NO",
  "tr",
  "fi",
  "id",
  "pl",
  "pt-BR",
  "it",
  "ru",
  "si",
  "vi",
  "ar",
  "es",
  "ja",
  "cs",
  "zh-Hans",
  "uk",
  "et",
  "ca",
  "el",
  "ta",
  "fa",
  "hi",
  "bn",
  "eo",
  "lt",
  "hr",
  "be",
  "hu",
  "nl",
  "pt",
  "zh-Hant",
  "oc",
  "da",
  "az",
  "he",
  "ro",
  "hy",
  "ko",
  "sv",
  "pa",
  "sq",
  "ia",
  "ckb",
  "ga",
  "kab",
  "fil",
  "br",
]

export function getLocale(language?: string): Locale {
  switch (language) {
    case "en":
      return enUS
    case "en-GB":
      return enGB
    case "de":
      return de
    case "fr":
      return fr
    case "nb-NO":
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
    case "pt-BR":
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
    case "zh-Hans":
      return zhCN // date-fns has no Simplified Chinese locale
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
    case "ta":
      return ta
    case "fa":
      return faIR // date-fns has no Persian locale
    case "hi":
      return hi
    case "bn":
      return bn
    case "eo":
      return eo
    case "lt":
      return lt
    case "hr":
      return hr
    case "be":
      return be
    case "hu":
      return hu
    case "nl":
      return nl
    case "pt":
      return pt
    case "zh-Hant":
      return zhCN // date-fns has no Traditional Chinese locale
    case "oc":
      return oc
    case "da":
      return da
    case "az":
      return az
    case "he":
      return he
    case "ro":
      return ro
    case "hy":
      return hy
    case "ko":
      return ko
    case "sv":
      return sv
    case "pa":
      return enUS // date-fns has no Punjabi locale
    case "ia":
      return enUS // date-fns has no Interlingua locale
    case "sq":
      return sq
    case "ckb":
      return ckb
    case "ga":
      return enUS // date-fns has no Irish locale
    case "kab":
      return enUS // date-fns has no Kurdish locale
    case "fil":
      return enUS // date-fns has no Filipino locale
    case "br":
      return ptBR

    default:
      return enGB
  }
}

export function bcpToPosixLocale(language?: string): string {
  switch (language) {
    case "en":
      return "en_US"
    case "de":
      return "de_DE"
    case "en-GB":
      return "en_GB"
    case "fr":
      return "fr_FR"
    case "nb-NO":
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
    case "pt-BR":
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
    case "zh-Hans":
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
    case "ta":
      return "ta_IN"
    case "fa":
      return "fa_IR"
    case "hi":
      return "hi_IN"
    case "bn":
      return "bn_IN"
    case "eo":
      return "eo"
    case "lt":
      return "lt_LT"
    case "hr":
      return "hr_HR"
    case "be":
      return "be_BY"
    case "hu":
      return "hu_HU"
    case "nl":
      return "nl_NL"
    case "pt":
      return "pt_PT"
    case "zh-Hant":
      return "zh_Hant"
    case "oc":
      return "oc"
    case "da":
      return "da_DK"
    case "az":
      return "az_AZ"
    case "he":
      return "he_IL"
    case "ro":
      return "ro_RO"
    case "hy":
      return "hy"
    case "ko":
      return "ko_KR"
    case "sv":
      return "sv_SE"
    case "pa":
      return "pa_IN"
    case "sq":
      return "sq_XK"
    case "ia":
      return "ia"
    case "ckb":
      return "ckb"
    case "ga":
      return "ga"
    case "kab":
      return "kab"
    case "fil":
      return "fil"
    case "br":
      return "pt_BR"

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
    case "en-GB":
      return "🇬🇧"
    case "fr":
      return "🇫🇷"
    case "nb-NO":
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
    case "pt-BR":
      return "🇧🇷"
    case "ru":
      return "🇷🇺"
    case "si":
      return "🇱🇰"
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
    case "zh-Hans":
      return ""
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
    case "ta":
      return "🇮🇳"
    case "fa":
      return "🇮🇷"
    case "hi":
      return "🇮🇳"
    case "bn":
      return "🇧🇩"
    case "eo":
      return ""
    case "lt":
      return "🇱🇹"
    case "hr":
      return "🇭🇷"
    case "be":
      return "🇧🇾"
    case "hu":
      return "🇭🇺"
    case "nl":
      return "🇳🇱"
    case "pt":
      return "🇵🇹"
    case "zh-Hant":
      return ""
    case "oc":
      return ""
    case "da":
      return "🇩🇰"
    case "az":
      return "🇦🇿"
    case "he":
      return "🇮🇱"
    case "ro":
      return "🇷🇴"
    case "hy":
      return "🇦🇲"
    case "ko":
      return "🇰🇷"
    case "sv":
      return "🇸🇪"
    case "pa":
      return "🇮🇳"
    case "sq":
      return "🇦🇱"
    case "ia":
      return ""
    case "ckb":
      return ""
    case "ga":
      return "🇮🇪"
    case "kab":
      return ""
    case "fil":
      return "🇵🇭"
    case "br":
      return "🇧🇷"
  }
}

export function getLanguageName(language: Language): string {
  const languageDisplayNames = new Intl.DisplayNames(language, {
    type: "language",
  })

  return languageDisplayNames.of(language) ?? language
}

export function getIntlLocale(language?: string): Intl.Locale {
  switch (language) {
    case "en":
    case "en-US":
    case "en_US":
      return new Intl.Locale("en", {
        region: "US",
      })
    case "de":
      return new Intl.Locale("de")
    case "en-GB":
    case "en_GB":
      return new Intl.Locale("en", {
        region: "GB",
      })
    case "fr":
      return new Intl.Locale("fr")
    case "nb-NO":
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
    case "pt-BR":
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
    case "zh-Hans":
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
    case "ta":
      return new Intl.Locale("ta")
    case "fa":
      return new Intl.Locale("fa")
    case "hi":
      return new Intl.Locale("hi")
    case "bn":
      return new Intl.Locale("bn")
    case "eo":
      return new Intl.Locale("eo")
    case "lt":
      return new Intl.Locale("lt")
    case "hr":
      return new Intl.Locale("hr")
    case "be":
      return new Intl.Locale("be")
    case "hu":
      return new Intl.Locale("hu")
    case "nl":
      return new Intl.Locale("nl")
    case "pt":
      return new Intl.Locale("pt")
    case "zh-Hant":
      return new Intl.Locale("zh", {
        script: "Hant",
      })
    case "oc":
      return new Intl.Locale("oc")
    case "da":
      return new Intl.Locale("da")
    case "az":
      return new Intl.Locale("az")
    case "he":
      return new Intl.Locale("he")
    case "ro":
      return new Intl.Locale("ro")
    case "hy":
      return new Intl.Locale("hy")
    case "ko":
      return new Intl.Locale("ko")
    case "sv":
      return new Intl.Locale("sv")
    case "pa":
      return new Intl.Locale("pa")
    case "sq":
      return new Intl.Locale("sq")
    case "ia":
      return new Intl.Locale("ia")
    case "ckb":
      return new Intl.Locale("ckb")
    case "ga":
      return new Intl.Locale("ga")
    case "kab":
      return new Intl.Locale("kab")
    case "fil":
      return new Intl.Locale("fil")
    case "br":
      return new Intl.Locale("br")

    default:
      return new Intl.Locale("en")
  }
}
