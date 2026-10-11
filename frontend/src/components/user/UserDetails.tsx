import { useTranslations } from "next-intl"
import { FunctionComponent, useState } from "react"
import { useUserContext } from "../../context/user-info"
import ProviderLink from "../login/ProviderLink"
import Avatar from "./Avatar"
import { getUserName } from "src/verificationProvider"
import { ConnectedAccountProvider, LoginMethod } from "src/codegen"
import {
  useDoChangeDefaultAccountAuthChangeDefaultAccountPost,
  useDoChangeDisplayNameAuthDisplayNamePost,
} from "src/codegen/auth/auth"
import { useMeUsersMeGet } from "src/codegen/users/users"
import { toast } from "sonner"
import { isAxiosError } from "axios"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Copy } from "lucide-react"

interface Props {
  logins: LoginMethod[]
}

const UserDetails: FunctionComponent<Props> = ({ logins }) => {
  const user = useUserContext()
  const t = useTranslations()
  const [changingDefault, setChangingDefault] = useState(false)
  const [displayNameDraft, setDisplayNameDraft] = useState<string | null>(null)

  const changeDefaultMutation =
    useDoChangeDefaultAccountAuthChangeDefaultAccountPost()

  const changeDisplayNameMutation = useDoChangeDisplayNameAuthDisplayNamePost({
    axios: { withCredentials: true },
  })

  const { data: meData } = useMeUsersMeGet({
    query: { enabled: !!user.info },
    axios: { withCredentials: true },
  })
  const userId = meData?.data?.id

  // Nothing to show if not logged in
  if (!user.info) {
    return <></>
  }

  const handleSetDefault = async (provider: string) => {
    setChangingDefault(true)
    try {
      await changeDefaultMutation.mutateAsync({
        params: { provider: provider as unknown as ConnectedAccountProvider },
      })
      toast.success(t("default-account-changed"))
      // Refresh user info to show updated default
      window.location.reload()
    } catch (error) {
      toast.error(t("network-error-try-again"))
    } finally {
      setChangingDefault(false)
    }
  }

  const savedDisplayName = (user.info.displayname ?? "").trim()
  const displayName = displayNameDraft ?? user.info.displayname ?? ""
  const trimmedDisplayName = displayName.trim()
  const displayNameLength = Array.from(trimmedDisplayName).length
  const displayNameValid =
    displayNameLength >= 1 &&
    displayNameLength <= 100 &&
    !/[\p{Cc}\u202a-\u202e\u2066-\u2069]/u.test(trimmedDisplayName) &&
    /[^\p{Cf}\p{Zs}\p{Zl}\p{Zp}]/u.test(trimmedDisplayName)
  const showDisplayNameError = displayNameDraft !== null && !displayNameValid
  const canSaveDisplayName =
    !changeDisplayNameMutation.isPending &&
    displayNameValid &&
    trimmedDisplayName !== savedDisplayName

  const handleSaveDisplayName = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSaveDisplayName) {
      return
    }
    try {
      await changeDisplayNameMutation.mutateAsync({
        data: { display_name: trimmedDisplayName },
      })
      toast.success(t("display-name-updated"))
      window.location.reload()
    } catch (error) {
      toast.error(
        isAxiosError(error) && error.response?.status === 422
          ? t("display-name-invalid")
          : t("network-error-try-again"),
      )
    }
  }

  // Accounts may or may not be present in user information
  const linkedAccounts = logins
    .filter(
      (provider) =>
        provider.method in user.info.auths && user.info.auths[provider.method],
    )
    .map((provider) => {
      const authData = user.info.auths[provider.method]
      const isDefault = user.info.default_account.provider === provider.method

      return (
        <li
          key={provider.method}
          className="flex flex-wrap items-center gap-3 py-3"
        >
          <span aria-hidden="true" className="shrink-0">
            <Avatar
              userName={user.info.displayname}
              avatarUrl={authData.avatar}
            />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{provider.name}</span>
              {isDefault && (
                <Badge variant="outline">{t("default-account")}</Badge>
              )}
            </div>
            <span className="break-all text-sm text-foreground/75">
              {authData.login}
            </span>
          </div>
          {!isDefault && (
            <Button
              onClick={() => handleSetDefault(provider.method)}
              disabled={changingDefault}
              variant="outline"
              size="sm"
            >
              {t("set-as-default")}
            </Button>
          )}
        </li>
      )
    })

  // The user may have further sign in options available
  const linkOptions = logins
    .filter((provider) => !user.info.auths[provider.method])
    .map((provider) => (
      <ProviderLink key={provider.method} provider={provider} inACard />
    ))

  const isEmailDefault = user.info.default_account.provider === "email"

  const emailAccountCard = user.info.email_login ? (
    <li key="email" className="flex items-center gap-3 py-3">
      <div className="flex size-10 shrink-0 items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="h-8 w-8"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
          />
        </svg>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{t("email-account")}</span>
          {isEmailDefault && (
            <Badge variant="outline">{t("default-account")}</Badge>
          )}
        </div>
        <span className="break-all text-sm text-foreground/75">
          {user.info.email_login.email}
        </span>
        <span
          className={
            user.info.email_login.enabled
              ? "text-sm opacity-75"
              : "text-sm font-medium text-flathub-red"
          }
        >
          {user.info.email_login.enabled
            ? t("verified-email")
            : t("email-login-replaced")}
        </span>
      </div>
    </li>
  ) : undefined

  const loginSection = linkOptions.length ? (
    <div>
      <h3 className="mb-3 text-base font-semibold">
        {t("link-more-accounts")}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">{linkOptions}</div>
    </div>
  ) : (
    <></>
  )

  const displayNameWithFallback = getUserName(user.info)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{displayNameWithFallback}</h2>

        {userId !== undefined && (
          <div className="flex items-center gap-3 text-sm text-foreground/75">
            <span>{t("user-id")}</span>
            <Button
              variant="outline"
              size="sm"
              aria-label={`${t("copy-text")}: ${t("user-id")} ${userId}`}
              title={t("copy-text")}
              onClick={() => navigator.clipboard.writeText(String(userId))}
            >
              <span className="font-mono">{userId}</span>
              <Copy size={14} aria-hidden="true" data-icon="inline-end" />
            </Button>
          </div>
        )}
      </div>
      <Separator className="opacity-40" />

      <div>
        <div className="mb-2 text-sm font-semibold">
          <label htmlFor="display-name">{t("display-name")}</label>
        </div>
        <form
          className="flex items-center gap-3"
          onSubmit={handleSaveDisplayName}
        >
          <Input
            id="display-name"
            value={displayName}
            onChange={(event) => setDisplayNameDraft(event.target.value)}
            aria-invalid={showDisplayNameError}
            aria-describedby={
              showDisplayNameError ? "display-name-error" : undefined
            }
          />
          <Button type="submit" disabled={!canSaveDisplayName}>
            {t("save")}
          </Button>
        </form>
        {showDisplayNameError && (
          <p id="display-name-error" className="mt-2 text-sm text-destructive">
            {t("display-name-invalid")}
          </p>
        )}
      </div>
      <Separator className="opacity-40" />

      <div>
        <h3 className="mb-1 text-base font-semibold">{t("linked-accounts")}</h3>
        <ul className="divide-y divide-border/40">
          {linkedAccounts}
          {emailAccountCard}
        </ul>
      </div>

      {loginSection}
    </div>
  )
}

export default UserDetails
