import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"
import * as rootParams from "next/root-params"
import { notFound } from "next/navigation"
import { routing } from "./routing"
import deepmerge from "deepmerge"

export default getRequestConfig(async ({ locale }) => {
  if (!locale) {
    const paramValue = await rootParams.locale()

    if (hasLocale(routing.locales, paramValue)) {
      locale = paramValue
    } else {
      notFound()
    }
  }

  const defaultMessages = (await import(`../../public/locales/en/common.json`))
    .default
  const defaultDistroMessages = (
    await import(`../../public/locales/en/distros.json`)
  ).default

  // Load messages for the requested locale
  const messages = deepmerge(
    { ...defaultMessages, distros: { ...defaultDistroMessages } },
    {
      ...(await import(`../../public/locales/${locale}/common.json`)).default,
      distros: {
        ...(await import(`../../public/locales/${locale}/distros.json`))
          .default,
      },
    },
  )

  return {
    locale,
    messages,
  }
})
