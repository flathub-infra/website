"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { useLocale, useTranslations } from "next-intl"
import { isAxiosError } from "axios"
import {
  browserSupportsWebAuthn,
  startAuthentication,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser"
import {
  getLoginMethodsAuthLoginGet,
  listPasskeysAuthPasskeysGet,
  passkeyReauthenticationOptionsAuthPasskeysReauthenticationOptionsPost,
  passkeyReauthenticationVerifyAuthPasskeysReauthenticationVerifyPost,
  requestEmailLoginAuthEmailRequestPost,
  type LoginMethod,
  type PasskeyList,
  type PasskeyReauthenticationVerifyRequestCredential,
} from "src/codegen"
import { useUserContext, useUserDispatch } from "src/context/user-info"
import { usePathname, useRouter } from "src/i18n/navigation"
import { getApiBaseUrl } from "src/utils/api-url"
import { Button } from "@/components/ui/button"
import Modal from "./Modal"
import Spinner from "./Spinner"
import ProviderLink from "./login/ProviderLink"

interface Props {
  shown: boolean
  onReauthenticated: () => void
  onCancelled: () => void
}

const credentials = { withCredentials: true }

const ReauthDialog = ({ shown, onReauthenticated, onCancelled }: Props) => {
  const t = useTranslations()
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()
  const user = useUserContext()
  const dispatch = useUserDispatch()
  const supported = useSyncExternalStore(
    () => () => {},
    browserSupportsWebAuthn,
    () => null,
  )
  const [methods, setMethods] = useState<{
    providers: LoginMethod[]
    passkeys: PasskeyList
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const generation = useRef(0)

  useEffect(() => {
    if (!shown) return
    const current = ++generation.current

    Promise.all([
      getLoginMethodsAuthLoginGet(),
      listPasskeysAuthPasskeysGet(credentials),
    ])
      .then(([providers, passkeys]) => {
        if (generation.current !== current) return
        setMethods({ providers: providers.data, passkeys: passkeys.data })
      })
      .catch(() => {
        if (generation.current === current) {
          setStatus(t("network-error-try-again"))
        }
      })
      .finally(() => {
        if (generation.current === current) setLoading(false)
      })

    return () => {
      generation.current = current + 1
    }
  }, [shown, t])

  const cancel = () => {
    generation.current++
    onCancelled()
  }

  const authenticatePasskey = async () => {
    if (busy) return
    const current = generation.current
    setBusy(true)
    setStatus(null)
    try {
      const options =
        await passkeyReauthenticationOptionsAuthPasskeysReauthenticationOptionsPost(
          {},
          credentials,
        )
      if (generation.current !== current) return
      const credential = await startAuthentication({
        optionsJSON: options.data
          .options as unknown as PublicKeyCredentialRequestOptionsJSON,
      })
      if (generation.current !== current) return
      await passkeyReauthenticationVerifyAuthPasskeysReauthenticationVerifyPost(
        {
          challenge_id: options.data.challenge_id,
          credential:
            credential as unknown as PasskeyReauthenticationVerifyRequestCredential,
        },
        credentials,
      )
      if (generation.current === current) onReauthenticated()
    } catch (error) {
      if (generation.current !== current) return
      const responseStatus = isAxiosError(error)
        ? error.response?.status
        : undefined
      if (error instanceof Error && error.name === "NotAllowedError") {
        setStatus(t("passkey-login-canceled"))
      } else if (responseStatus === 429) {
        setStatus(t("passkey-rate-limited"))
      } else if (responseStatus === 503 || responseStatus === undefined) {
        setStatus(t("passkey-unavailable"))
      } else {
        setStatus(t("passkey-login-failed"))
      }
    } finally {
      if (generation.current === current) setBusy(false)
    }
  }

  const authenticateEmail = async () => {
    if (busy || !user.info?.email_login?.enabled) return
    const current = generation.current
    setBusy(true)
    setStatus(null)
    try {
      await requestEmailLoginAuthEmailRequestPost(
        { email: user.info.email_login.email, locale, return_to: pathname },
        credentials,
      )
      if (generation.current === current) setEmailSent(true)
    } catch {
      if (generation.current === current) {
        setStatus(t("network-error-try-again"))
      }
    } finally {
      if (generation.current === current) setBusy(false)
    }
  }

  const signOut = async () => {
    if (busy) return
    const current = generation.current
    setBusy(true)
    setStatus(null)
    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/logout`, {
        method: "POST",
        credentials: "include",
      })
      if (!response.ok) throw new Error("Logout failed")
      dispatch({ type: "logout" })
      cancel()
      router.push(`/login?returnTo=${encodeURIComponent(pathname)}`)
    } catch {
      if (generation.current === current) {
        setStatus(t("network-error-try-again"))
      }
    } finally {
      if (generation.current === current) setBusy(false)
    }
  }

  const providers =
    methods?.providers.filter(
      (provider) => user.info?.auths[provider.method],
    ) ?? []
  const hasPasskey =
    supported === true && !!methods?.passkeys.credentials.length
  const hasEmail = user.info?.email_login?.enabled === true
  const noUsableMethod =
    methods !== null &&
    user.info !== undefined &&
    user.info !== null &&
    supported !== null &&
    !hasPasskey &&
    !hasEmail &&
    providers.length === 0

  return (
    <Modal
      shown={shown}
      title={t("reauth-title")}
      description={t("reauth-description")}
      onClose={cancel}
      cancelButton={{ onClick: cancel }}
    >
      {emailSent ? (
        <p role="status">{t("email-login-check-your-inbox")}</p>
      ) : loading ? (
        <Spinner size="s" />
      ) : (
        <fieldset disabled={busy} className="flex flex-col gap-3">
          {hasPasskey && (
            <Button type="button" onClick={() => void authenticatePasskey()}>
              {t("login-with-passkey")}
            </Button>
          )}
          {providers.map((provider) => (
            <ProviderLink
              key={provider.method}
              provider={provider}
              inACard
              compact
              reauth
            />
          ))}
          {hasEmail && methods !== null && (
            <Button type="button" onClick={() => void authenticateEmail()}>
              {t("reauth-method-email")}
            </Button>
          )}
          {noUsableMethod && (
            <Button type="button" onClick={() => void signOut()}>
              {t("reauth-sign-out")}
            </Button>
          )}
        </fieldset>
      )}
      {!loading && methods !== null && (providers.length > 0 || hasEmail) && (
        <p className="mt-3 text-sm">{t("reauth-return-hint")}</p>
      )}
      {status && (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 text-sm text-flathub-red"
        >
          {status}
        </p>
      )}
    </Modal>
  )
}

export default ReauthDialog
