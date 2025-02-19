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

import "../styles/main.scss"
import { useRouter } from "next/router"
import { bcpToPosixLocale, getLocale } from "../src/localize"
import Main from "../src/components/layout/Main"

import { Inter } from "next/font/google"
import * as Sentry from "@sentry/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MotionConfig } from "framer-motion"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"

import cardImage from "../public/img/card.webp"
import { Fragment, ReactElement, ReactNode, useState } from "react"
import { setDefaultOptions } from "date-fns"
import axios from "axios"
import { NextPage } from "next"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({
  subsets: ["latin"],
  fallback: ["sans-serif"],
})

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode
}

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout
}

const App = ({ Component, pageProps }: AppPropsWithLayout) => {
  const { t } = useTranslation()
  const getLayout = Component.getLayout ?? ((page) => page)

  setDefaultOptions({ locale: getLocale(i18n?.language) })

  const [queryClient] = useState(() => new QueryClient({}))

  axios.interceptors.request.use((config) => {
    return {
      ...config,
      baseURL: process.env.NEXT_PUBLIC_API_BASE_URI,
    }
  })

  const router = useRouter()
  const instance = createInstance({
    urlBase: process.env.NEXT_PUBLIC_SITE_BASE_URI || "",
    siteId: Number(process.env.NEXT_PUBLIC_MATOMO_WEBSITE_ID) || 38,
    trackerUrl: "https://webstats.gnome.org/matomo.php",
    srcUrl: "https://webstats.gnome.org/matomo.js",
    configurations: {
      disableCookies: true,
    },
  })

  return (
    <MatomoProvider value={instance}>
      <ThemeProvider attribute="class">
        <DefaultSeo
          dangerouslySetAllPagesToNoIndex={!IS_PRODUCTION}
          titleTemplate={`%s | ${t("flathub")}`}
          defaultTitle={t("flathub-apps-for-linux")}
          description={t("flathub-description")}
          canonical={`${process.env.NEXT_PUBLIC_SITE_BASE_URI}${router.asPath}`}
          languageAlternates={router.locales.map((lang) => ({
            hrefLang: lang,
            href: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/${lang}${router.asPath}`,
          }))}
          twitter={{
            cardType: "summary_large_image",
          }}
          openGraph={{
            type: "website",
            locale: bcpToPosixLocale(router?.locale),
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
              <Main>{getLayout(<Component {...pageProps} />)}</Main>
            </UserInfoProvider>
            <Toaster
              position={i18n?.dir() === "rtl" ? "bottom-left" : "bottom-right"}
              dir={i18n?.dir()}
            />
            <ReactQueryDevtools initialIsOpen={false} />
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
      <p>{error!.toString()}</p>
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
