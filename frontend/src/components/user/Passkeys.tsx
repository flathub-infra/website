"use client"

import { FormEvent, useCallback, useState, useSyncExternalStore } from "react"
import { useFormatter, useTranslations } from "next-intl"
import { isAxiosError } from "axios"
import {
  browserSupportsWebAuthn,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
} from "@simplewebauthn/browser"
import {
  deletePasskeyAuthPasskeysPasskeyIdDelete,
  passkeyRegistrationOptionsAuthPasskeysRegistrationOptionsPost,
  passkeyRegistrationVerifyAuthPasskeysRegistrationVerifyPost,
  renamePasskeyAuthPasskeysPasskeyIdPatch,
  type PasskeyRegistrationVerifyRequestCredential,
  type PasskeySummary,
} from "src/codegen"
import { useListPasskeysAuthPasskeysGet } from "src/codegen/passkeys/passkeys"
import { getUserData } from "src/asyncs/login"
import { useUserContext, useUserDispatch } from "src/context/user-info"
import { useRouter } from "src/i18n/navigation"
import { getApiBaseUrl } from "src/utils/api-url"
import ConfirmDialog from "../ConfirmDialog"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import type { JSX } from "react"

const withCredentials = { withCredentials: true }

const Passkeys = (): JSX.Element => {
  const t = useTranslations()
  const format = useFormatter()
  const user = useUserContext()
  const dispatch = useUserDispatch()
  const router = useRouter()

  const profile = user.info?.invite_code
  const passkeys = useListPasskeysAuthPasskeysGet({
    query: {
      queryKey: ["/auth/passkeys", profile],
      enabled: profile !== undefined,
      gcTime: 0,
    },
    axios: withCredentials,
  })
  const list = passkeys.data?.data ?? null
  const supported = useSyncExternalStore(
    () => () => {},
    browserSupportsWebAuthn,
    () => null,
  )
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [reauthError, setReauthError] = useState(false)
  const reauthRequired = reauthError || list?.recent_authentication === false
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(
    null,
  )
  const [removing, setRemoving] = useState<PasskeySummary | null>(null)

  const fail = useCallback(
    async (error: unknown) => {
      const detail = isAxiosError(error)
        ? (error.response?.data as { detail?: unknown } | undefined)?.detail
        : undefined
      const responseStatus = isAxiosError(error)
        ? error.response?.status
        : undefined
      if (error instanceof Error && error.name === "NotAllowedError") {
        setStatus(t("passkey-canceled"))
      } else if (
        (error instanceof Error && error.name === "InvalidStateError") ||
        detail === "passkey_already_registered"
      ) {
        setStatus(t("passkey-already-registered"))
      } else if (detail === "reauthentication_required") {
        setStatus(null)
        setReauthError(true)
      } else if (detail === "invalid_passkey_name") {
        setStatus(t("passkey-name-invalid"))
      } else if (responseStatus === 401) {
        await getUserData(dispatch)
        router.replace(`/login?returnTo=${encodeURIComponent("/settings")}`)
      } else if (responseStatus === 429) {
        setStatus(t("passkey-rate-limited"))
      } else if (
        isAxiosError(error) &&
        (responseStatus === undefined || responseStatus === 503)
      ) {
        setStatus(t("passkey-unavailable"))
      } else {
        setStatus(t("passkey-action-failed"))
      }
    },
    [dispatch, router, t],
  )

  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (busy || !trimmed) return
    setBusy(true)
    setStatus(null)
    try {
      const options =
        await passkeyRegistrationOptionsAuthPasskeysRegistrationOptionsPost(
          {},
          withCredentials,
        )
      const credential = await startRegistration({
        optionsJSON: options.data
          .options as unknown as PublicKeyCredentialCreationOptionsJSON,
      })
      await passkeyRegistrationVerifyAuthPasskeysRegistrationVerifyPost(
        {
          challenge_id: options.data.challenge_id,
          credential:
            credential as unknown as PasskeyRegistrationVerifyRequestCredential,
          name: trimmed,
        },
        withCredentials,
      )
      setName("")
      setStatus(t("passkey-added"))
      await passkeys.refetch()
    } catch (error) {
      await fail(error)
    } finally {
      setBusy(false)
    }
  }

  const rename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || renaming === null || !renaming.name.trim()) return
    setBusy(true)
    setStatus(null)
    try {
      await renamePasskeyAuthPasskeysPasskeyIdPatch(
        renaming.id,
        { name: renaming.name.trim() },
        withCredentials,
      )
      setRenaming(null)
      setStatus(t("passkey-renamed"))
      await passkeys.refetch()
    } catch (error) {
      await fail(error)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (busy || removing === null) return
    const passkeyId = removing.id
    setRemoving(null)
    setBusy(true)
    setStatus(null)
    try {
      await deletePasskeyAuthPasskeysPasskeyIdDelete(passkeyId, withCredentials)
      setStatus(t("passkey-removed"))
      const refreshed = await passkeys.refetch()
      if (refreshed.error) await fail(refreshed.error)
    } catch (error) {
      await fail(error)
    } finally {
      setBusy(false)
    }
  }

  const reauthenticate = async () => {
    setBusy(true)
    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/logout`, {
        method: "POST",
        credentials: "include",
      })
      if (!response.ok) {
        setStatus(t("network-error-try-again"))
        return
      }
    } catch {
      setStatus(t("network-error-try-again"))
      return
    } finally {
      setBusy(false)
    }
    dispatch({ type: "logout" })
    router.push(`/login?returnTo=${encodeURIComponent("/settings")}`)
  }

  if (!user.info) {
    return <></>
  }

  const formatTime = (value: string) =>
    format.dateTime(
      new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`),
      { dateStyle: "medium", timeStyle: "short" },
    )

  return (
    <section aria-labelledby="passkeys-heading">
      <h3 id="passkeys-heading" className="my-4 text-xl font-semibold">
        {t("passkeys")}
      </h3>
      <Card className="w-full py-0">
        <CardContent className="flex flex-col gap-4 p-5">
          <p className="text-sm opacity-75">{t("passkeys-description")}</p>

          {passkeys.isError && (
            <p role="alert" className="text-sm text-flathub-red">
              {t("network-error-try-again")}
            </p>
          )}

          {list !== null && list.credentials.length === 0 && (
            <p>{t("passkeys-empty")}</p>
          )}

          {list !== null && list.credentials.length > 0 && (
            <ul className="flex flex-col gap-3">
              {list.credentials.map((credential) => (
                <li
                  key={credential.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg bg-flathub-gainsborow/40 p-4 dark:bg-flathub-gainsborow/10"
                >
                  {renaming?.id === credential.id ? (
                    <form
                      className="flex flex-1 flex-wrap items-center gap-3"
                      onSubmit={rename}
                    >
                      <label
                        htmlFor={`passkey-name-${credential.id}`}
                        className="sr-only"
                      >
                        {t("passkey-name")}
                      </label>
                      <Input
                        id={`passkey-name-${credential.id}`}
                        className="max-w-xs"
                        maxLength={100}
                        value={renaming.name}
                        onChange={(event) =>
                          setRenaming({
                            id: credential.id,
                            name: event.target.value,
                          })
                        }
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={busy || !renaming.name.trim()}
                      >
                        {t("save")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setRenaming(null)}
                      >
                        {t("cancel")}
                      </Button>
                    </form>
                  ) : (
                    <>
                      <div className="flex flex-1 flex-col">
                        <span className="font-semibold">{credential.name}</span>
                        <span className="text-sm opacity-75">
                          {t("passkey-created-at", {
                            time: formatTime(credential.created_at),
                          })}
                        </span>
                        <span className="text-sm opacity-75">
                          {credential.last_used_at
                            ? t("passkey-last-used-at", {
                                time: formatTime(credential.last_used_at),
                              })
                            : t("passkey-never-used")}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          setRenaming({
                            id: credential.id,
                            name: credential.name,
                          })
                        }
                      >
                        {t("passkey-rename")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy || reauthRequired}
                        onClick={() => setRemoving(credential)}
                      >
                        {t("remove")}
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {reauthRequired && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-flathub-sonic-silver/30 p-4">
              <p className="flex-1 text-sm">{t("passkey-reauth-required")}</p>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void reauthenticate()}
              >
                {t("passkey-reauth-action")}
              </Button>
            </div>
          )}

          <form className="flex flex-wrap items-end gap-3" onSubmit={add}>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="new-passkey-name"
                className="text-sm font-semibold"
              >
                {t("passkey-name")}
              </label>
              <Input
                id="new-passkey-name"
                className="max-w-xs"
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!supported || reauthRequired}
              />
            </div>
            <Button
              type="submit"
              disabled={busy || !supported || reauthRequired || !name.trim()}
            >
              {t("passkey-add")}
            </Button>
          </form>
          {supported === false && (
            <p className="text-sm opacity-75">{t("passkey-unsupported")}</p>
          )}

          <p role="status" aria-live="polite" className="text-sm">
            {status}
          </p>
        </CardContent>
      </Card>

      <ConfirmDialog
        isVisible={removing !== null}
        prompt={t("passkey-remove-prompt", { name: removing?.name ?? "" })}
        description={t("passkey-remove-description")}
        action={t("remove")}
        actionVariant="destructive"
        onConfirmed={() => void remove()}
        onCancelled={() => setRemoving(null)}
      />
    </section>
  )
}

export default Passkeys
