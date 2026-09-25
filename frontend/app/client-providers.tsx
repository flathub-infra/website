"use client"

import "src/utils/axios-config"
import { ReactNode } from "react"
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
import { setDefaultOptions } from "date-fns"
import { getDateFnsLocale } from "src/localize"

const queryClient = new QueryClient()
const shouldTrack = (): boolean =>
  typeof window === "undefined" ||
  !/^\/[a-z]{2,3}(?:-[A-Za-z]{2,4})?\/login\/email\/confirm\/?$/.test(
    window.location.pathname,
  )

const instance = shouldTrack()
  ? createInstance({
      urlBase: process.env.NEXT_PUBLIC_SITE_BASE_URI || "",
      siteId: Number(process.env.NEXT_PUBLIC_MATOMO_WEBSITE_ID) || 38,
      trackerUrl: "https://webstats.gnome.org/matomo.php",
      srcUrl: "https://webstats.gnome.org/matomo.js",
      configurations: {
        disableCookies: true,
      },
    })
  : null

interface ClientProvidersProps {
  children: ReactNode
  locale: string
}

export default function ClientProviders({
  children,
  locale,
}: ClientProvidersProps) {
  const direction = getLangDir(locale)

  setDefaultOptions({ locale: getDateFnsLocale(locale) })

  const tree = (
    <ThemeProvider attribute="class">
      <MotionConfig reducedMotion="user">
        <QueryClientProvider client={queryClient}>
          <UserInfoProvider>{children}</UserInfoProvider>
          <Toaster
            position={direction === "rtl" ? "bottom-left" : "bottom-right"}
            dir={direction}
          />
          {shouldTrack() && <ReactQueryDevtools initialIsOpen={false} />}
        </QueryClientProvider>
      </MotionConfig>
    </ThemeProvider>
  )

  if (instance === null) {
    return tree
  }

  return <MatomoProvider value={instance}>{tree}</MatomoProvider>
}
