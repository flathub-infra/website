import {
  createInstance,
  MatomoProvider,
} from "@mitresthen/matomo-tracker-react"
import { DefaultSeo } from "next-seo"
import { ThemeProvider } from "next-themes"
import type { AppProps } from "next/app"

import "react-responsive-carousel/lib/styles/carousel.min.css" // Requires a loader
import { UserInfoProvider } from "../src/context/user-info"
import { IMAGE_BASE_URL, IS_PRODUCTION } from "../src/env"
import { appWithTranslation, useTranslation } from "next-i18next"

import "react-toastify/dist/ReactToastify.css"
import { ToastContainer } from "react-toastify"

import "../styles/main.scss"
import { useRouter } from "next/router"
import { bcpToPosixLocale, languages } from "../src/localize"
import Main from "../src/components/layout/Main"

import { Inter } from "next/font/google"
import * as Sentry from "@sentry/react"
import { Error } from "../src/components/Error"

const inter = Inter({
  subsets: ["latin"],
})

const App = ({ Component, pageProps }: AppProps) => {
  const { t } = useTranslation()

  const router = useRouter()
  const instance = createInstance({
    urlBase: process.env.NEXT_PUBLIC_SITE_BASE_URI,
    siteId: Number(process.env.NEXT_PUBLIC_MATOMO_WEBSITE_ID) || 38,
    trackerUrl: "https://webstats.gnome.org/matomo.php",
    srcUrl: "https://webstats.gnome.org/matomo.js",
  })

  return (
    <MatomoProvider value={instance}>
      <ThemeProvider>
        <DefaultSeo
          dangerouslySetAllPagesToNoIndex={!IS_PRODUCTION}
          titleTemplate="%s | Flathub"
          defaultTitle="Flathub"
          description={t("flathub-description")}
          languageAlternates={languages.map((lang) => ({
            hrefLang: lang,
            href: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/${lang}`,
          }))}
          twitter={{
            site: "@FlatpakApps",
            cardType: "summary_large_image",
          }}
          openGraph={{
            type: "website",
            locale: bcpToPosixLocale(router.locale),
            url: process.env.NEXT_PUBLIC_SITE_BASE_URI,
            siteName: "Flathub",
            images: [
              {
                url: `${IMAGE_BASE_URL}card.webp`,
              },
            ],
          }}
        />
        <UserInfoProvider>
          <Main className={inter.className}>
            <Component {...pageProps} />
          </Main>
        </UserInfoProvider>
        <ToastContainer position="bottom-right" />
      </ThemeProvider>
    </MatomoProvider>
  )
}

export default Sentry.withErrorBoundary(appWithTranslation(App), {
  fallback: <Error />,
})
