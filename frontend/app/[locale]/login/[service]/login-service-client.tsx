"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { login } from "../../../../src/asyncs/login"
import Spinner from "../../../../src/components/Spinner"
import {
  useUserContext,
  useUserDispatch,
} from "../../../../src/context/user-info"
import { useLocalStorage } from "../../../../src/hooks/useLocalStorage"
import { usePendingTransaction } from "../../../../src/hooks/usePendingTransaction"
import { isInternalRedirect } from "../../../../src/utils/security"
import { useMutation } from "@tanstack/react-query"
import type { JSX } from "react"
import { usePathname, useRouter } from "src/i18n/navigation"

interface LoginServiceClientProps {
  services: string[]
}

const LoginServiceClient = ({
  services,
}: LoginServiceClientProps): JSX.Element => {
  const t = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

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
    mutationFn: () => login(dispatch, pathname.split("/").reverse()[0], query),
    onSuccess: () => {
      if (pendingTransaction) {
        router.push("/purchase", { locale })
        return
      } else if (returnTo) {
        const redirect = decodeURIComponent(returnTo)
        setReturnTo(null)

        // Must validate the redirect to prevent open redirect and code execution
        if (isInternalRedirect(redirect)) {
          router.push(redirect, { locale })
          return
        }
      }

      router.push("/", { locale })
    },
    onError: (error: any) => {
      toast.error(t(error.message))
    },
  })

  // Once router ready, perform login
  useEffect(() => {
    if (loginQuery.isIdle) {
      // redirect to correct locale, which we stored on the providers page
      const [, newlocale] = document.cookie
        .split("; ")
        .find((row) => row.startsWith("NEXT_LOCALE="))
        ?.split("=") ?? [null, null]

      setLocale(newlocale || undefined)

      if (newlocale && typeof window !== "undefined") {
        const currentLocale = window.location.pathname.split("/")[1]
        if (newlocale !== currentLocale) {
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

  // This is purely a loading page
  return <Spinner size="l" />
}

export default LoginServiceClient
