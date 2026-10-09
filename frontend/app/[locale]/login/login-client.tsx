"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import LoginProviders from "../../../src/components/login/Providers"
import PasskeyButton from "../../../src/components/login/PasskeyButton"
import { useUserContext } from "../../../src/context/user-info"
import { getApiBaseUrl } from "../../../src/utils/api-url"
import { Link, useRouter } from "src/i18n/navigation"

import type { JSX } from "react"
import type { LoginMethod } from "src/codegen"

interface LoginClientProps {
  providers: LoginMethod[]
  locale: string
  emailForm?: boolean
  developerLogin?: boolean
  embedded?: boolean
}

const RESEND_COOLDOWN_SECONDS = 60

const LoginClient = ({
  providers,
  locale,
  emailForm = false,
  developerLogin = false,
  embedded = false,
}: LoginClientProps): JSX.Element => {
  const t = useTranslations()
  const user = useUserContext()
  const router = useRouter()
  const returnTo = useSearchParams().get("returnTo")
  const loginHref = returnTo
    ? `/login?returnTo=${encodeURIComponent(returnTo)}`
    : "/login"
  const [email, setEmail] = useState("")
  const [submitState, setSubmitState] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle")
  const [cooldown, setCooldown] = useState(0)
  const passkeyVerified = useRef(false)

  // Set NEXT_LOCALE cookie to match locale of this page
  useEffect(() => {
    if (!locale) return
    document.cookie = `NEXT_LOCALE=${locale};path=/;SameSite=Strict`
  }, [locale])

  useEffect(() => {
    // Let email-only users add a developer provider from the developer sign-in
    // flow. Other signed-in users are already using a developer identity.
    const hasProviderAccount = user.info
      ? Object.entries(user.info.auths).some(
          ([provider, account]) =>
            provider !== "email" && account !== undefined && account !== null,
        )
      : false
    if (
      user.info &&
      !user.loading &&
      !passkeyVerified.current &&
      (!developerLogin || hasProviderAccount)
    ) {
      router.replace("/")
    }
  }, [user, router, developerLogin])

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
      {!emailForm && providers.length > 0 && (
        <LoginProviders providers={providers} compact={developerLogin} />
      )}
      {emailForm && (
        <form
          className={
            embedded
              ? "flex w-full flex-col gap-3"
              : "flex w-full flex-col gap-3 p-5 sm:w-[400px]"
          }
          onSubmit={submitEmail}
        >
          {!embedded && (
            <h2 className="text-xl font-bold">{t("email-login-with-email")}</h2>
          )}
          {submitState === "sent" && (
            <p
              role="status"
              className="rounded-xl bg-flathub-celestial-blue/10 p-4 text-sm leading-relaxed"
            >
              {t("email-login-check-your-inbox")}
            </p>
          )}
          <label htmlFor="login-email" className="text-sm font-semibold">
            {t("email-login-email-address")}
          </label>
          <input
            id="login-email"
            name="email"
            className={
              "rounded-xl border border-flathub-sonic-silver/40 bg-flathub-white p-3.5 dark:border-flathub-gainsborow/25 dark:bg-flathub-arsenic " +
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flathub-celestial-blue"
            }
            type="email"
            required
            value={email}
            autoComplete="email"
            onChange={(e) => {
              setEmail(e.target.value)
              if (submitState === "error") setSubmitState("idle")
            }}
          />
          <button
            className="mt-1 flex flex-row items-center justify-center rounded-xl bg-flathub-celestial-blue p-3.5 font-bold text-flathub-white transition-colors hover:bg-flathub-celestial-blue-dark dark:hover:bg-flathub-celestial-blue-light focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-flathub-celestial-blue disabled:cursor-not-allowed disabled:opacity-40"
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
            <p role="alert" className="text-sm text-flathub-red">
              {t("network-error-try-again")}
            </p>
          )}
        </form>
      )}
      {!user.info && (
        <div
          className={
            developerLogin
              ? "mt-3 w-full"
              : !emailForm
                ? "w-full"
                : embedded
                  ? "mt-3 w-full"
                  : "w-full px-5 pb-5 sm:w-[400px]"
          }
        >
          <PasskeyButton
            returnTo={returnTo}
            compact={developerLogin}
            onVerified={() => {
              passkeyVerified.current = true
            }}
          />
        </div>
      )}
      {emailForm && !embedded && (
        <Link href={loginHref} className="text-flathub-celestial-blue">
          {t("email-login-other-methods")}
        </Link>
      )}
    </div>
  )
}

export default LoginClient
