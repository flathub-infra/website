import { defineRouting } from "next-intl/routing"
import { languages } from "src/localize"

export const routing = defineRouting({
  locales: languages,

  defaultLocale: "en",
})
