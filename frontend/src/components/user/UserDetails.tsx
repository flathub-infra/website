import { useTranslations } from "next-intl"
import { FunctionComponent, useState } from "react"
import { useUserContext } from "../../context/user-info"
import ProviderLink from "../login/ProviderLink"
import Avatar from "./Avatar"
import { getUserName } from "src/verificationProvider"
import { ConnectedAccountProvider, LoginMethod } from "src/codegen"
import { useDoChangeDefaultAccountAuthChangeDefaultAccountPost } from "src/codegen/auth/auth"
import { useMeUsersMeGet } from "src/codegen/users/users"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface Props {
  logins: LoginMethod[]
}

const UserDetails: FunctionComponent<Props> = ({ logins }) => {
  const user = useUserContext()
  const t = useTranslations()
  const [changingDefault, setChangingDefault] = useState(false)

  const changeDefaultMutation =
    useDoChangeDefaultAccountAuthChangeDefaultAccountPost()

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
        <Card key={provider.method} className="w-full py-0 md:w-auto">
          <CardContent className="flex items-center gap-3 p-5">
            <Avatar
              userName={user.info.displayname}
              avatarUrl={authData.avatar}
            />
            <div className="flex flex-1 flex-col">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{provider.name}</span>
                {isDefault && (
                  <span className="rounded bg-flathub-celestial-blue px-2 py-0.5 text-xs font-medium text-white dark:bg-flathub-celestial-blue">
                    {t("default-account")}
                  </span>
                )}
              </div>
              <span>{authData.login}</span>
            </div>
            {!isDefault && (
              <Button
                onClick={() => handleSetDefault(provider.method)}
                disabled={changingDefault}
                variant="secondary"
                size="sm"
              >
                {t("set-as-default")}
              </Button>
            )}
          </CardContent>
        </Card>
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
    <Card key="email" className="w-full py-0 md:w-auto">
      <CardContent className="flex items-center gap-3 p-5">
        <div className="flex h-16 w-16 items-center justify-center">
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
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{t("email-login-with-email")}</span>
            {isEmailDefault && (
              <span className="rounded bg-flathub-celestial-blue px-2 py-0.5 text-xs font-medium text-white dark:bg-flathub-celestial-blue">
                {t("default-account")}
              </span>
            )}
          </div>
          <span>{user.info.email_login.email}</span>
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
      </CardContent>
    </Card>
  ) : undefined

  const loginSection = linkOptions.length ? (
    <div>
      <h3 className="my-4 text-xl font-semibold">{t("link-more-accounts")}</h3>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {linkOptions}
      </div>
    </div>
  ) : (
    <></>
  )

  const displayNameWithFallback = getUserName(user.info)

  return (
    <>
      <h1 className="col-start-1 row-start-1 mb-3 mt-0 text-4xl font-extrabold">
        {displayNameWithFallback}
      </h1>

      {userId !== undefined && (
        <div className="mb-4">
          <h3 className="my-4 text-xl font-semibold">{t("user-id")}</h3>
          <Card className="inline-flex py-0">
            <CardContent className="flex items-center gap-3 p-5">
              <span className="font-mono">{userId}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigator.clipboard.writeText(String(userId))}
              >
                {t("copy-text")}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <div>
        <h3 className="my-4 text-xl font-semibold">{t("linked-accounts")}</h3>
        <div className="flex flex-row flex-wrap gap-3">
          {linkedAccounts}
          {emailAccountCard}
        </div>
      </div>

      {loginSection}
    </>
  )
}

export default UserDetails
