"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { login } from "../../../../src/asyncs/login"
import Spinner from "../../../../src/components/Spinner"
import {
  useUserContext,
  useUserDispatch,
} from "../../../../src/context/user-info"
import { useLocalStorage } from "../../../../src/hooks/useLocalStorage"
import { usePendingTransaction } from "../../../../src/hooks/usePendingTransaction"
import {
  isBackendRedirect,
  isInternalRedirect,
} from "../../../../src/utils/security"
import { useMutation } from "@tanstack/react-query"
import type { JSX } from "react"
import { Link, usePathname, useRouter } from "src/i18n/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface LoginServiceClientProps {
  services: string[]
}

const gitlabProviders: Record<string, { name: string; url: string }> = {
  gitlab: { name: "GitLab", url: "https://gitlab.com" },
  gnome: { name: "GNOME GitLab", url: "https://gitlab.gnome.org" },
  kde: { name: "KDE GitLab", url: "https://invent.kde.org" },
}

const LoginServiceClient = ({
  services,
}: LoginServiceClientProps): JSX.Element => {
  const t = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const service = pathname.split("/").at(-1) ?? ""

  const user = useUserContext()
  const dispatch = useUserDispatch()

  const [pendingTransaction] = usePendingTransaction()
  const [returnTo, setReturnTo] = useLocalStorage<string | null>(
    "returnTo",
    null,
  )

  const [locale, setLocale] = useState<string | undefined>(undefined)

  // Convert searchParams to query object for compatibility
  const query = Object.fromEntries(searchParams.entries())

  const loginQuery = useMutation({
    mutationFn: () => login(dispatch, service, query),
    onSuccess: () => {
      if (pendingTransaction) {
        router.push("/purchase", { locale })
        return
      } else if (returnTo) {
        const redirect = decodeURIComponent(returnTo)
        setReturnTo(null)

        // Must validate the redirect to prevent open redirect and code execution
        if (isInternalRedirect(redirect)) {
          if (isBackendRedirect(redirect)) {
            // OIDC /authorize is a backend endpoint, not a Next.js route. Resuming
            // the authorization-code flow needs a full-page navigation so the browser
            // hits the backend with the session cookie and no locale prefix.
            window.location.assign(redirect)
          } else {
            router.push(redirect, { locale })
          }
          return
        }
      }

      router.push("/", { locale })
    },
  })

  // Once router ready, perform login
  useEffect(() => {
    if (loginQuery.isIdle) {
      // redirect to correct locale, which we stored on the providers page
      const getCookie = (name: string): string | null => {
        const value = `; ${document.cookie}`
        const parts = value.split(`; ${name}=`)
        if (parts.length === 2) {
          return parts.pop()?.split(";").shift() || null
        }
        return null
      }

      const newlocale = getCookie("NEXT_LOCALE")
      setLocale(newlocale || undefined)

      if (newlocale && typeof window !== "undefined") {
        const currentLocale = window.location.pathname.split("/")[1]
        // Only redirect if we're not in the middle of a login flow
        // The presence of 'code' and 'state' parameters indicates we're returning from OAuth
        const urlParams = new URLSearchParams(window.location.search)
        const hasOAuthParams = urlParams.has("code") && urlParams.has("state")

        if (newlocale !== currentLocale && !hasOAuthParams) {
          router.push("/", { locale: newlocale })
          return
        }
      }

      loginQuery.mutate()
    }
  }, [loginQuery, router])

  // Redirect away if user tries some kind of directory traversal
  useEffect(() => {
    const service =
      searchParams.get("service") || window.location.pathname.split("/").pop()
    const code = searchParams.get("code")
    const state = searchParams.get("state")

    if (
      !services.some((s: string) => s === service) ||
      code == null ||
      state == null
    ) {
      router.push("/", { locale })
      return
    }
  }, [router, user, services, searchParams])

  if (loginQuery.isError) {
    const gitlabProvider = gitlabProviders[service]
    const termsError =
      loginQuery.error.message === "gitlab-terms-not-accepted" &&
      gitlabProvider !== undefined
    const errorKey =
      termsError || loginQuery.error.message === "error-already-logged-in"
        ? loginQuery.error.message
        : loginQuery.error.message === "network-error-try-again"
          ? "network-error-try-again"
          : "login-failed-try-again"
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
        <Alert variant="destructive">
          <AlertTitle>{t("login-failed")}</AlertTitle>
          <AlertDescription>
            <p>
              {termsError
                ? t("gitlab-terms-not-accepted", {
                    provider: gitlabProvider.name,
                  })
                : t(errorKey)}
            </p>
            {termsError ? (
              <a href={gitlabProvider.url} className="underline">
                {t("open-login-provider", { provider: gitlabProvider.name })}
              </a>
            ) : null}
          </AlertDescription>
        </Alert>
        <Link href="/login" className="underline">
          {t("back-to-login")}
        </Link>
      </div>
    )
  }

  return <Spinner size="l" />
}

export default LoginServiceClient
