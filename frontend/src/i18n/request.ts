import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"
import { routing } from "./routing"
import deepmerge from "deepmerge"

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale

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
