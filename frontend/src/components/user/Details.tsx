import { useTranslation } from "next-i18next"
import Image from "next/image"
import Link from "next/link"
import { FunctionComponent } from "react"
import { useUserContext } from "../../context/user-info"
import { LoginProvider } from "../../types/Login"
import Button from "../Button"
import LogoutButton from "../login/LogoutButton"
import ProviderLink from "../login/ProviderLink"
import DeleteButton from "./DeleteButton"
import VendingLink from "./VendingLink"

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
          className="flex items-center gap-3 rounded-xl bg-bgColorPrimary py-2 px-6 text-textPrimary"
        >
          <Image
            src={authData.avatar}
            width={50}
            height={50}
            className="rounded-full"
            alt={`${authData.login}'s avatar`}
          />
          <p>
            <b>{provider.name}</b>
            <br />
            {authData.login}
          </p>
        </div>
      )
    })

  // The user may have further sign in options available
  const linkOptions = logins
    .filter((provider) => !user.info.auths[provider.method])
    .map((provider) => (
      <ProviderLink key={provider.method} provider={provider} />
    ))

  const loginSection = linkOptions.length ? (
    <div className="mx-4 my-auto">
      <h3>{t("link-more-accounts")}</h3>
      <div className="flex flex-row flex-wrap gap-3">{linkOptions}</div>
    </div>
  ) : (
    <></>
  )

  return (
    <div className="grid rounded-xl bg-bgColorSecondary p-4 text-textPrimary shadow-md">
      <h2 className="col-start-1 row-start-1 mt-0 mb-3">
        {user.info.displayname}
      </h2>

      <div className="mx-4 my-auto">
        <h3>{t("linked-accounts")}</h3>
        <div className="flex flex-row flex-wrap gap-3">{linkedAccounts}</div>
      </div>

      {loginSection}

      {user.info["dev-flatpaks"].length ? (
        <div className="mx-4 my-auto">
          <h3>{t("accepting-payment")}</h3>
          <VendingLink />
        </div>
      ) : (
        <></>
      )}

      <div className="row-start-1 row-end-4 ml-auto flex flex-col gap-2">
        <Link href="/wallet" passHref>
          <Button variant="primary">{t("view-wallet")}</Button>
        </Link>
        <LogoutButton />
      </div>
    </div>
  )
}

export default UserDetails
