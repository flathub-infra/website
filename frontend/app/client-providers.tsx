"use client"

import "src/utils/axios-config"
import { ReactNode, useEffect, useMemo } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { MatomoContext, createInstance } from "@mitresthen/matomo-tracker-react"
import { UserInfoProvider } from "../src/context/user-info"
import { MotionConfig } from "framer-motion"
import { Toaster } from "@/components/ui/sonner"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { getLangDir } from "rtl-detect"
import { setDefaultOptions } from "date-fns"
import { getDateFnsLocale } from "src/localize"
import { usePathname } from "next/navigation"
import { isEmailConfirmRoute } from "src/utils/security"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { isAxiosError } from "axios"

const queryClient = new QueryClient()

interface ClientProvidersProps {
  children: ReactNode
  locale: string
}

export default function ClientProviders({
  children,
  locale,
}: ClientProvidersProps) {
  const track = !isEmailConfirmRoute(usePathname())
  const instance = useMemo(
    () =>
      track
        ? createInstance({
            urlBase: process.env.NEXT_PUBLIC_SITE_BASE_URI || "",
            siteId: Number(process.env.NEXT_PUBLIC_MATOMO_WEBSITE_ID) || 38,
            trackerUrl: "https://webstats.gnome.org/matomo.php",
            srcUrl: "https://webstats.gnome.org/matomo.js",
            configurations: {
              disableCookies: true,
            },
          })
        : null,
    [track],
  )
  const direction = getLangDir(locale)

  setDefaultOptions({ locale: getDateFnsLocale(locale) })

  const t = useTranslations()
  useEffect(() => {
    const notify = (event: {
      type: string
      action?: { type: string; error?: unknown }
    }) => {
      if (
        event.type === "updated" &&
        event.action?.type === "error" &&
        isAxiosError(event.action.error) &&
        event.action.error.response?.data?.detail === "oauth_upgrade_required"
      ) {
        toast.error(t("email-login-oauth-upgrade-required"))
      }
    }
    const unsubscribeQueries = queryClient.getQueryCache().subscribe(notify)
    const unsubscribeMutations = queryClient
      .getMutationCache()
      .subscribe(notify)
    return () => {
      unsubscribeQueries()
      unsubscribeMutations()
    }
  }, [t])

  const tree = (
    <ThemeProvider attribute="class">
      <MotionConfig reducedMotion="user">
        <QueryClientProvider client={queryClient}>
          <UserInfoProvider>{children}</UserInfoProvider>
          <Toaster
            position={direction === "rtl" ? "bottom-left" : "bottom-right"}
            dir={direction}
          />
          {track && <ReactQueryDevtools initialIsOpen={false} />}
        </QueryClientProvider>
      </MotionConfig>
    </ThemeProvider>
  )

  return (
    <MatomoContext.Provider value={instance}>{tree}</MatomoContext.Provider>
  )
}
