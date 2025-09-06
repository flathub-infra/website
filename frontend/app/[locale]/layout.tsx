import { ReactNode } from "react"
import { Inter } from "next/font/google"
import { getLangDir } from "rtl-detect"
import ClientProviders from "../client-providers"
import Main from "../../src/components/layout/Main"
import { NextIntlClientProvider } from "next-intl"
import { setDefaultOptions } from "date-fns"
import { getDateFnsLocale } from "src/localize"
import { Metadata } from "next"
import { bcpToPosixLocale, languages } from "src/localize"
import { getTranslations } from "next-intl/server"
import cardImage from "../../public/img/card.webp"
import { IS_PRODUCTION } from "src/env"
import { headers } from "next/headers"

const inter = Inter({
  subsets: ["latin"],
  fallback: ["sans-serif"],
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const t = await getTranslations()
  const { locale } = await params

  // Get the current pathname from headers
  const headersList = await headers()
  const pathname = headersList.get("x-pathname") || ""

  const canonical = `${process.env.NEXT_PUBLIC_SITE_BASE_URI}${pathname.replace(`/${locale}`, "/en")}`
  const url = `${process.env.NEXT_PUBLIC_SITE_BASE_URI}${pathname}`

  return {
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_BASE_URI || "https://flathub.org",
    ),
    robots: {
      index: locale === "en-GB" ? false : IS_PRODUCTION,
      follow: IS_PRODUCTION,
    },
    title: {
      template: `%s | ${t("flathub")}`,
      default: t("flathub-apps-for-linux"),
    },
    description: t("flathub-description"),
    icons: {
      icon: [
        {
          url: "/favicon.svg",
          type: "image/svg+xml",
          sizes: "any",
        },
        {
          url: "/favicon.png",
          type: "image/png",
        },
      ],
      apple: "/apple-touch-icon.png",
    },
    alternates: {
      canonical,
      languages: languages
        .filter((lang) => lang !== "en" && lang !== "en-GB")
        .reduce(
          (acc, lang) => {
            // Extract the base path after removing the locale prefix
            let basePath = ""

            if (pathname.startsWith(`/${locale}/`)) {
              // Case: /de/feeds -> feeds
              basePath = pathname.slice(locale.length + 2)
            } else if (pathname === `/${locale}` || pathname === "/") {
              // Case: /de or / (index page) -> empty
              basePath = ""
            } else if (pathname.startsWith("/")) {
              // Case: /feeds (no locale prefix) -> feeds
              basePath = pathname.slice(1)
            } else {
              // Case: feeds (no leading slash) -> feeds
              basePath = pathname
            }

            // Build the localized URL
            if (basePath) {
              acc[lang] = `/${lang}/${basePath}`
            } else {
              // Index page
              acc[lang] = `/${lang}`
            }
            return acc
          },
          {} as Record<string, string>,
        ),
    },
    twitter: {
      card: "summary_large_image",
    },
    openGraph: {
      type: "website",
      locale: bcpToPosixLocale(locale),
      url,
      siteName: t("flathub-apps-for-linux"),
      images: [
        {
          url: cardImage.src,
        },
      ],
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

  setDefaultOptions({ locale: getDateFnsLocale(locale) })

  return (
    <html suppressHydrationWarning lang={locale} dir={getLangDir(locale)}>
      <head />
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
