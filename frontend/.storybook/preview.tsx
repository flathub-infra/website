import "../styles/main.scss"
import i18n from "./i18next"
import { languages, getLanguageName, getLanguageFlag } from "../src/localize"
import { withThemeByClassName } from "@storybook/addon-themes"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import React, { Suspense, useEffect } from "react"
import { faker } from "@faker-js/faker"
import { I18nextProvider } from "react-i18next"

// Use a fixed seed, so that the faker data doesn't change
// Important for chromatic change detection
faker.seed(42)
faker.setDefaultRefDate(new Date(2024, 0, 1))

const queryClient = new QueryClient()

// Create a global variable called locale in storybook
// and add a menu in the toolbar to change your locale
export const globalTypes = {
  locale: {
    name: "Locale",
    description: "Internationalization locale",
    toolbar: {
      icon: "globe",
      items: languages.map((lng) => ({
        value: lng,
        title: getLanguageName(lng),
        right: getLanguageFlag(lng),
      })),
      showName: true,
    },
  },
}

const withI18next = (Story, context) => {
  const { locale } = context.globals

  // When the locale global changes
  // Set the new locale in i18n
  useEffect(() => {
    i18n.changeLanguage(locale)
  }, [locale])

  return (
    // This catches the suspense from components not yet ready (still loading translations)
    // Alternative: set useSuspense to false on i18next.options.react when initializing i18next
    <Suspense fallback={<div>loading translations...</div>}>
      <I18nextProvider i18n={i18n}>
        <Story />
      </I18nextProvider>
    </Suspense>
  )
}

export default {
  parameters: { mockingDate: new Date(2024, 0, 1) },
  decorators: [
    withI18next,
    (Story) => (
      <QueryClientProvider client={queryClient}>{Story()}</QueryClientProvider>
    ),
    withThemeByClassName({
      themes: {
        light: "light",
        dark: "dark",
      },
      defaultTheme: "dark",
    }),
  ],
}
