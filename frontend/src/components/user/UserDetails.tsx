import { useTranslations } from "next-intl"
import { FunctionComponent, useState } from "react"
import { useUserContext } from "../../context/user-info"
import ProviderLink from "../login/ProviderLink"
import Avatar from "./Avatar"
import { getUserName } from "src/verificationProvider"
import { ConnectedAccountProvider, LoginMethod } from "src/codegen"
import { useDoChangeDefaultAccountAuthChangeDefaultAccountPost } from "src/codegen/auth/auth"
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

      <div>
        <h3 className="my-4 text-xl font-semibold">{t("linked-accounts")}</h3>
        <div className="flex flex-row flex-wrap gap-3">{linkedAccounts}</div>
      </div>

      {loginSection}
    </>
  )
}

export default UserDetails
