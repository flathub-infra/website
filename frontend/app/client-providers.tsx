"use client"

import { ReactNode } from "react"
import { NextIntlClientProvider } from "next-intl"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import {
  MatomoProvider,
  createInstance,
} from "@mitresthen/matomo-tracker-react"
import { UserInfoProvider } from "../src/context/user-info"
import { MotionConfig } from "framer-motion"
import { Toaster } from "@/components/ui/sonner"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { getLangDir } from "rtl-detect"

const queryClient = new QueryClient()

const instance = createInstance({
  urlBase: process.env.NEXT_PUBLIC_SITE_BASE_URI || "",
  siteId: Number(process.env.NEXT_PUBLIC_MATOMO_WEBSITE_ID) || 38,
  trackerUrl: "https://webstats.gnome.org/matomo.php",
  srcUrl: "https://webstats.gnome.org/matomo.js",
  configurations: {
    disableCookies: true,
  },
})

interface ClientProvidersProps {
  children: ReactNode
  locale: string
  messages: any
}

export default function ClientProviders({
  children,
  locale,
  messages,
}: ClientProvidersProps) {
  const direction = getLangDir(locale)

  return (
    <MatomoProvider value={instance}>
      <ThemeProvider attribute="class">
        <MotionConfig reducedMotion="user">
          <QueryClientProvider client={queryClient}>
            <NextIntlClientProvider locale={locale} messages={messages}>
              <UserInfoProvider>{children}</UserInfoProvider>
              <Toaster
                position={direction === "rtl" ? "bottom-left" : "bottom-right"}
                dir={direction}
              />
              <ReactQueryDevtools initialIsOpen={false} />
            </NextIntlClientProvider>
          </QueryClientProvider>
        </MotionConfig>
      </ThemeProvider>
    </MatomoProvider>
  )
}
