"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import LoginProviders from "../../../src/components/login/Providers"
import { useUserContext } from "../../../src/context/user-info"
import { getApiBaseUrl } from "../../../src/utils/api-url"
import { useRouter } from "src/i18n/navigation"

import type { JSX } from "react"
import type { LoginMethod } from "src/codegen"

interface LoginClientProps {
  providers: LoginMethod[]
  locale: string
}

const RESEND_COOLDOWN_SECONDS = 60

const LoginClient = ({ providers, locale }: LoginClientProps): JSX.Element => {
  const t = useTranslations()
  const user = useUserContext()
  const router = useRouter()

  const [emailLoginEnabled, setEmailLoginEnabled] = useState(false)
  const [email, setEmail] = useState("")
  const [submitState, setSubmitState] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle")
  const [cooldown, setCooldown] = useState(0)

  // Set NEXT_LOCALE cookie to match locale of this page
  useEffect(() => {
    if (!locale) return
    document.cookie = `NEXT_LOCALE=${locale};path=/;SameSite=Strict`
  }, [locale])

  useEffect(() => {
    // Already logged in, just redirect to userpage
    if (user.info && !user.loading) {
      router.replace("/")
    }
  }, [user, router])

  useEffect(() => {
    let cancelled = false
    fetch(`${getApiBaseUrl()}/auth/email/config`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setEmailLoginEnabled(data.enabled === true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const submitEmail = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (submitState === "sending" || cooldown > 0) return
      setSubmitState("sending")
      const returnTo = new URLSearchParams(window.location.search).get(
        "returnTo",
      )
      try {
        const res = await fetch(`${getApiBaseUrl()}/auth/email/request`, {
          method: "POST",
          credentials: "include" as RequestCredentials,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            locale,
            return_to: returnTo ?? "/",
          }),
        })
        if (res.status === 202) {
          setSubmitState("sent")
          setCooldown(RESEND_COOLDOWN_SECONDS)
        } else {
          setSubmitState("error")
        }
      } catch {
        setSubmitState("error")
      }
    },
    [cooldown, email, locale, submitState],
  )

  return (
    <div className="flex flex-col items-center">
      <LoginProviders providers={providers} />
      {emailLoginEnabled && (
        <form
          className="flex w-full flex-col gap-3 p-5 sm:w-[400px]"
          onSubmit={submitEmail}
        >
          <h2 className="text-xl font-bold">{t("email-login-with-email")}</h2>
          {submitState === "sent" ? (
            <p>{t("email-login-check-your-inbox")}</p>
          ) : (
            <>
              <input
                className={
                  "rounded-xl bg-flathub-white p-3 shadow-md dark:bg-flathub-arsenic " +
                  "placeholder:opacity-50 dark:placeholder:opacity-40"
                }
                type="email"
                required
                value={email}
                placeholder={t("email-login-email-address")}
                autoComplete="email"
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (submitState === "error") setSubmitState("idle")
                }}
              />
              <button
                className="flex flex-row items-center justify-center rounded-xl bg-flathub-celestial-blue p-3 font-bold text-flathub-white hover:opacity-60 disabled:cursor-not-allowed disabled:opacity-40"
                type="submit"
                disabled={submitState === "sending" || cooldown > 0}
              >
                {cooldown > 0
                  ? t("email-login-resend-in", { seconds: cooldown })
                  : submitState === "sending"
                    ? t("email-login-sending")
                    : t("email-login-send-link")}
              </button>
              {submitState === "error" && (
                <p className="text-sm text-flathub-red">
                  {t("network-error-try-again")}
                </p>
              )}
            </>
          )}
        </form>
      )}
    </div>
  )
}

export default LoginClient
