import {
  createInstance,
  MatomoProvider,
} from "@mitresthen/matomo-tracker-react"
import { DefaultSeo } from "next-seo"
import { ThemeProvider } from "next-themes"
import type { AppProps } from "next/app"

import { UserInfoProvider } from "../src/context/user-info"
import { IS_PRODUCTION } from "../src/env"
import { appWithTranslation, i18n, useTranslation } from "next-i18next"

import "react-toastify/dist/ReactToastify.css"
import { toast, ToastContainer } from "react-toastify"

import "../styles/main.scss"
import { useRouter } from "next/router"
import { bcpToPosixLocale, languages } from "../src/localize"
import Main from "../src/components/layout/Main"

import { Inter } from "next/font/google"
import * as Sentry from "@sentry/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MotionConfig } from "framer-motion"

import cardImage from "../public/img/card.webp"
import { Fragment } from "react"

const inter = Inter({
  subsets: ["latin"],
  fallback: ["sans-serif"],
})

const App = ({ Component, pageProps }: AppProps) => {
  const { t } = useTranslation()

  const queryClient = new QueryClient()

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
          defaultTitle={t("flathub-apps-for-linux")}
          description={t("flathub-description")}
          languageAlternates={languages.map((lang) => ({
            hrefLang: lang,
            href: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/${lang}`,
          }))}
          twitter={{
            cardType: "summary_large_image",
          }}
          openGraph={{
            type: "website",
            locale: bcpToPosixLocale(router.locale),
            url: process.env.NEXT_PUBLIC_SITE_BASE_URI,
            siteName: t("flathub-apps-for-linux"),
            images: [
              {
                url: cardImage.src,
              },
            ],
          }}
        />
        <MotionConfig reducedMotion="user">
          <QueryClientProvider client={queryClient}>
            <UserInfoProvider>
              <style jsx global>{`
                html {
                  font-family: ${inter.style.fontFamily};
                }
              `}</style>
              <Main>
                <Component {...pageProps} />
              </Main>
            </UserInfoProvider>
            <ToastContainer
              position={
                i18n.dir() === "rtl"
                  ? toast.POSITION.BOTTOM_LEFT
                  : toast.POSITION.BOTTOM_RIGHT
              }
              rtl={i18n.dir() === "rtl"}
            />
          </QueryClientProvider>
        </MotionConfig>
      </ThemeProvider>
    </MatomoProvider>
  )
}

export default Sentry.withErrorBoundary(appWithTranslation(App), {
  fallback: ({ error, componentStack, resetError }) => (
    <Fragment>
      <h3>You have encountered an error</h3>
      <p>{error.toString()}</p>
      <p>{componentStack}</p>
      <button
        onClick={() => {
          resetError()
        }}
      >
        Click here to retry!
      </button>
    </Fragment>
  ),
})
