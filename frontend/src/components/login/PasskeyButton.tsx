"use client"

import { useCallback, useId, useState, useSyncExternalStore } from "react"
import { useTranslations } from "next-intl"
import { clsx } from "clsx"
import { isAxiosError } from "axios"
import {
  browserSupportsWebAuthn,
  startAuthentication,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser"
import {
  passkeyAuthenticationOptionsAuthPasskeysAuthenticationOptionsPost,
  passkeyAuthenticationVerifyAuthPasskeysAuthenticationVerifyPost,
  type PasskeyAuthenticationVerifyRequestCredential,
} from "src/codegen"
import { getUserData } from "src/asyncs/login"
import { useUserDispatch } from "src/context/user-info"
import { useRouter } from "src/i18n/navigation"
import { isBackendRedirect, isInternalRedirect } from "src/utils/security"
import Spinner from "../Spinner"

import type { JSX } from "react"

interface Props {
  returnTo?: string | null
  compact?: boolean
  onVerified?: () => void
}

type PasskeyState =
  "idle" | "busy" | "canceled" | "rate-limited" | "unavailable" | "failed"

const PasskeyIcon = (): JSX.Element => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    aria-hidden="true"
    className="h-8 w-8"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z"
    />
  </svg>
)

const PasskeyButton = ({
  returnTo = null,
  compact = false,
  onVerified,
}: Props): JSX.Element => {
  const t = useTranslations()
  const router = useRouter()
  const dispatch = useUserDispatch()
  const supported = useSyncExternalStore(
    () => () => {},
    browserSupportsWebAuthn,
    () => null,
  )
  const [state, setState] = useState<PasskeyState>("idle")
  const statusId = useId()

  const signIn = useCallback(async () => {
    if (state === "busy") return
    setState("busy")
    const credentials = { withCredentials: true }
    try {
      const options =
        await passkeyAuthenticationOptionsAuthPasskeysAuthenticationOptionsPost(
          { return_to: returnTo },
          credentials,
        )
      const credential = await startAuthentication({
        optionsJSON: options.data
          .options as unknown as PublicKeyCredentialRequestOptionsJSON,
      })
      const verified =
        await passkeyAuthenticationVerifyAuthPasskeysAuthenticationVerifyPost(
          {
            challenge_id: options.data.challenge_id,
            credential:
              credential as unknown as PasskeyAuthenticationVerifyRequestCredential,
          },
          credentials,
        )
      onVerified?.()
      await getUserData(dispatch)
      const destination = verified.data.return_to
      if (isInternalRedirect(destination) && isBackendRedirect(destination)) {
        window.location.assign(destination)
      } else {
        router.push(isInternalRedirect(destination) ? destination : "/")
      }
    } catch (error) {
      if (error instanceof Error && error.name === "NotAllowedError") {
        setState("canceled")
      } else if (isAxiosError(error) && error.response?.status === 429) {
        setState("rate-limited")
      } else if (
        isAxiosError(error) &&
        (error.response === undefined || error.response.status === 503)
      ) {
        setState("unavailable")
      } else {
        setState("failed")
      }
    }
  }, [dispatch, onVerified, returnTo, router, state])

  const message = {
    idle: null,
    busy: null,
    canceled: t("passkey-login-canceled"),
    "rate-limited": t("passkey-rate-limited"),
    unavailable: t("passkey-unavailable"),
    failed: t("passkey-login-failed"),
  }[state]

  return (
    <div className="flex w-full flex-col gap-2">
      <button
        type="button"
        className={
          compact
            ? clsx(
                "flex w-full flex-row items-center justify-start gap-4 rounded-xl border border-flathub-sonic-silver/20 p-4 font-bold shadow-md dark:border-flathub-gainsborow/15",
                "bg-flathub-white transition-colors hover:cursor-pointer hover:bg-flathub-gainsborow dark:bg-flathub-arsenic dark:hover:bg-flathub-sonic-silver",
                "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-flathub-celestial-blue disabled:cursor-not-allowed disabled:opacity-40",
              )
            : "flex w-full flex-row items-center justify-center gap-2 rounded-xl bg-flathub-white p-3.5 font-bold text-flathub-arsenic ring-1 ring-inset ring-flathub-sonic-silver/40 transition-colors hover:bg-flathub-gainsborow dark:bg-flathub-arsenic dark:text-flathub-white dark:ring-flathub-gainsborow/25 dark:hover:bg-flathub-sonic-silver focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-flathub-celestial-blue disabled:cursor-not-allowed disabled:opacity-40"
        }
        onClick={() => void signIn()}
        disabled={!supported || state === "busy"}
        aria-describedby={statusId}
      >
        <div
          className={
            compact
              ? "flex size-8 shrink-0 items-center justify-center [&>svg]:size-8"
              : "flex size-5 shrink-0 items-center justify-center [&>svg]:size-5"
          }
        >
          {state === "busy" ? <Spinner size="s" /> : <PasskeyIcon />}
        </div>
        {t("login-with-passkey")}
      </button>
      <p
        id={statusId}
        role="status"
        aria-live="polite"
        className="text-sm text-flathub-sonic-silver dark:text-flathub-gainsborow"
      >
        {supported === false ? t("passkey-unsupported") : message}
      </p>
    </div>
  )
}

export default PasskeyButton
