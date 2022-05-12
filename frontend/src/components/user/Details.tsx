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
import styles from "./Details.module.scss"
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
        <div key={provider.method} className={styles.linked}>
          <Image
            src={authData.avatar}
            width={50}
            height={50}
            className={styles.avatar}
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
    <div className={styles.subsection}>
      <h3>{t("link-more-accounts")}</h3>
      <div className={styles.authList}>{linkOptions}</div>
    </div>
  ) : (
    <></>
  )

  return (
    <div className="main-container">
      <div className={styles.details}>
        <h2 className={styles.displayname}>{user.info.displayname}</h2>

        <div className={styles.subsection}>
          <h3>{t("linked-accounts")}</h3>
          <div className={styles.authList}>{linkedAccounts}</div>
        </div>

        {loginSection}

        {user.info["dev-flatpaks"].length ? (
          <div className={styles.subsection}>
            <h3>{t("accepting-payment")}</h3>
            <VendingLink />
          </div>
        ) : (
          <></>
        )}

        <div className={styles.actions}>
          <Link href="/wallet" passHref>
            <Button variant="primary">{t("view-wallet")}</Button>
          </Link>
          <LogoutButton />
          <DeleteButton />
        </div>
      </div>
    </div>
  )
}

export default UserDetails
