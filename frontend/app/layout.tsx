import { ReactNode } from "react"
import "../styles/main.css"
import { Metadata } from "next"
import { bcpToPosixLocale } from "src/localize"
import { getTranslations } from "next-intl/server"
import cardImage from "../public/img/card.webp"
import { headers } from "next/headers"

export async function generateMetadata({
  locale,
}: {
  locale: string
}): Promise<Metadata> {
  const t = await getTranslations({ locale })
  const headersList = await headers()

  return {
    // dangerouslySetAllPagesToNoIndex={!IS_PRODUCTION}
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
      canonical: ["en-GB"].includes(locale)
        ? `${process.env.NEXT_PUBLIC_SITE_BASE_URI}${headersList.get("x-invoke-path")}`
        : undefined,
      // languages: languages.reduce((acc, lang) => {
      //   acc[lang] = `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/${lang}${pathname}`
      //   return acc
      // }, {}),
    },
    twitter: {
      card: "summary_large_image",
    },
    openGraph: {
      type: "website",
      locale: bcpToPosixLocale(locale),
      url: process.env.NEXT_PUBLIC_SITE_BASE_URI,
      siteName: t("flathub-apps-for-linux"),
      images: [
        {
          url: cardImage.src,
        },
      ],
    },
  }
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
