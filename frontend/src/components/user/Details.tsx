import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import { useUserContext } from "../../context/user-info"
import { LoginProvider } from "../../types/Login"
import ProviderLink from "../login/ProviderLink"
import Avatar from "./Avatar"
import { getUserName } from "src/verificationProvider"

interface Props {
  logins: LoginProvider[]
}

const UserDetails: FunctionComponent<Props> = ({ logins }) => {
  const user = useUserContext()
  const { t } = useTranslation()

  // Nothing to show if not logged in
  if (!user.info) {
    return <></>
  }

  // Accounts may or may not be present in user information
  const linkedAccounts = logins
    .filter((provider) => provider.method in user.info.auths)
    .map((provider) => {
      const authData = user.info.auths[provider.method]

      return (
        <div
          key={provider.method}
          className="flex w-full items-center gap-3 rounded-xl bg-flathub-white px-4 py-4 text-flathub-dark-gunmetal shadow-md dark:bg-flathub-gainsborow/10 dark:text-flathub-gainsborow md:w-auto"
        >
          <Avatar
            userName={user.info.displayname}
            avatarUrl={authData.avatar}
          />
          <div className="flex flex-col">
            <span className="font-semibold">{provider.name}</span>
            <span>{authData.login}</span>
          </div>
        </div>
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
