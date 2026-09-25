"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import Spinner from "src/components/Spinner"
import { useUserDispatch } from "../../../../../src/context/user-info"
import { getApiBaseUrl } from "../../../../../src/utils/api-url"
import { getUserData } from "src/asyncs/login"
import {
  isBackendRedirect,
  isInternalRedirect,
} from "../../../../../src/utils/security"
import { useRouter } from "src/i18n/navigation"
import type { JSX } from "react"
import type { EmailConfirmResult } from "src/codegen"

type ConfirmState =
  | "idle"
  | "busy"
  | "ok"
  | "invalid"
  | "conflict"
  | "rate-limited"
  | "unavailable"

const EmailConfirmClient = (): JSX.Element => {
  const t = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const userDispatch = useUserDispatch()

  const tokenRef = useRef<string | null>(null)
  const [state, setState] = useState<ConfirmState>("idle")
  const [logoutError, setLogoutError] = useState(false)

  useEffect(() => {
    if (tokenRef.current !== null) {
      return
    }
    const fromParams = searchParams.get("token")
    const fromFragment =
      typeof window !== "undefined" &&
      window.location.hash.startsWith("#token=")
        ? window.location.hash.slice("#token=".length)
        : null
    const token = fromParams ?? fromFragment
    if (token !== null) {
      const url = new URL(window.location.href)
      url.searchParams.delete("token")
      if (fromFragment !== null) url.hash = ""
      window.history.replaceState(
        window.history.state,
        "",
        url.pathname + url.search + url.hash,
      )
    }
    tokenRef.current = token
    if (token === null) {
      setState("invalid")
    }
  }, [searchParams])

  const applyReturnTo = useCallback(
    (returnTo: string) => {
      if (isInternalRedirect(returnTo)) {
        if (isBackendRedirect(returnTo)) {
          window.location.assign(returnTo)
          return
        }
        router.push(returnTo)
        return
      }
      router.push("/")
    },
    [router],
  )

  const confirm = useCallback(async () => {
    const token = tokenRef.current
    if (token === null || state === "busy" || state === "ok") {
      return
    }
    setState("busy")
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/email/confirm`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      if (res.status === 409) {
        setState("conflict")
        return
      }
      if (res.status === 429) {
        setState("rate-limited")
        return
      }
      if (res.status === 503) {
        setState("unavailable")
        return
      }
      if (res.status === 400) {
        setState("invalid")
        return
      }
      if (!res.ok) {
        setState("unavailable")
        return
      }
      const data: EmailConfirmResult = await res.json()
      setState("ok")
      await getUserData(userDispatch)
      applyReturnTo(data.return_to ?? "/")
    } catch {
      setState("unavailable")
    }
  }, [applyReturnTo, state, userDispatch])

  if (state === "ok") {
    return <Spinner size="l" />
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 p-5 text-center">
      <h1 className="text-2xl font-bold">{t("login")}</h1>
      {state === "invalid" && <p>{t("email-login-invalid-or-expired")}</p>}
      {state === "rate-limited" && <p>{t("email-login-rate-limited")}</p>}
      {state === "unavailable" && <p>{t("network-error-try-again")}</p>}
      {state === "conflict" && (
        <>
          <p>{t("email-login-session-conflict")}</p>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const res = await fetch(`${getApiBaseUrl()}/auth/logout`, {
                  method: "POST",
                  credentials: "include",
                })
                if (!res.ok) {
                  setLogoutError(true)
                  return
                }
              } catch {
                setLogoutError(true)
                return
              }
              setLogoutError(false)
              userDispatch({ type: "logout" })
              setState("idle")
            }}
          >
            {t("log-out")}
          </Button>
          {logoutError && <p>{t("network-error-try-again")}</p>}
        </>
      )}
      {state !== "invalid" && state !== "rate-limited" && (
        <Button onClick={() => void confirm()} disabled={state === "busy"}>
          {state === "busy" ? <Spinner size={"s"} /> : t("email-login-sign-in")}
        </Button>
      )}
      {(state === "invalid" || state === "rate-limited") && (
        <p className="text-sm opacity-75">
          {t("email-login-request-new-link")}
        </p>
      )}
    </div>
  )
}

export default EmailConfirmClient
