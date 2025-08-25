import { ReactNode } from "react"
import { Inter } from "next/font/google"
import { NextIntlClientProvider, useTranslations } from "next-intl"
import { getLangDir } from "rtl-detect"
import type { Metadata } from "next"
import { IS_PRODUCTION } from "../../src/env"
import ClientProviders from "../client-providers"
import Main from "../../src/components/layout/Main"
import cardImage from "../../public/img/card.webp"
import { bcpToPosixLocale } from "../../src/localize"
import { useRouter } from "next/navigation"

const inter = Inter({
  subsets: ["latin"],
  fallback: ["sans-serif"],
})

const t = useTranslations()

export const metadata: Metadata = {
  title: {
    template: `%s | ${t("flathub")}`,
    default: t("flathub-apps-for-linux"),
  },
  description: t("flathub-description"),
  openGraph: {
    type: "website",
    // locale: bcpToPosixLocale(router?.locale),
    url: process.env.NEXT_PUBLIC_SITE_BASE_URI,
    siteName: t("flathub-apps-for-linux"),
    images: [
      {
        url: cardImage.src,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: IS_PRODUCTION,
    follow: IS_PRODUCTION,
  },
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Load messages for this locale directly
  const messages = await import(
    `../../public/locales/${locale}/common.json`
  ).then((module) => module.default)

  return (
    <html lang={locale} dir={getLangDir(locale)}>
      <body className={inter.className}>
        <ClientProviders locale={locale} messages={messages}>
          <Main>{children}</Main>
        </ClientProviders>
      </body>
    </html>
  )
}
