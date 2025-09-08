import deepmerge from "deepmerge"

const defaultMessages = (await import(`../public/locales/en/common.json`))
  .default
const defaultDistroMessages = (
  await import(`../public/locales/en/distros.json`)
).default

export async function translationMessages(locale: string) {
  return deepmerge(
    { ...defaultMessages, distros: { ...defaultDistroMessages } },
    {
      ...(await import(`../public/locales/${locale}/common.json`)).default,
      distros: {
        ...(await import(`../public/locales/${locale}/distros.json`)).default,
      },
    },
  )
}
