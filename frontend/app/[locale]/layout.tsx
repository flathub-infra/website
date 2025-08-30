import { ReactNode } from "react"
import { Inter } from "next/font/google"
import { getLangDir } from "rtl-detect"
import type { Metadata } from "next"
import { IS_PRODUCTION } from "../../src/env"
import ClientProviders from "../client-providers"
import Main from "../../src/components/layout/Main"
import cardImage from "../../public/img/card.webp"
import { bcpToPosixLocale } from "../../src/localize"
import { getRequestConfig, getTranslations } from "next-intl/server"
import { NextIntlClientProvider, useMessages } from "next-intl"

const inter = Inter({
  subsets: ["latin"],
  fallback: ["sans-serif"],
})

export async function generateMetadata({
  locale,
}: {
  locale: string
}): Promise<Metadata> {
  const t = await getTranslations({ locale })

  return {
    title: t("rss-feeds"),
    description: t("rss-description"),
    openGraph: {
      url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/feeds`,
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return (
    <html lang={locale} dir={getLangDir(locale)}>
      <body className={inter.className}>
        <NextIntlClientProvider>
          <ClientProviders locale={locale}>
            <Main>{children}</Main>
          </ClientProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
