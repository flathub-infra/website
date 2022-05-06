import { useTranslation } from "next-i18next"
import Link from "next/link"
import { FunctionComponent, ReactElement } from "react"
import { useUserContext } from "../../context/user-info"
import styles from "./Status.module.scss"

const LoginStatus: FunctionComponent = () => {
  const user = useUserContext()
  const { t } = useTranslation()

  let status: ReactElement
  if (user.info) {
    // User has multiple login options, find one with an avatar
    const avatar = Object.values(user.info.auths).find(
      (auth) => auth.avatar,
    ).avatar

    status = (
      <>
        <Link href="/userpage" passHref>
          <a className={styles.user}>
            {user.info.displayname}
            <img
              src={avatar}
              className={styles.userAvatar}
              alt={t("user-avatar", { user: user.info.displayname })}
            />
          </a>
        </Link>
      </>
    )
  } else {
    status = (
      <Link href="/login" passHref>
        <a>{t("login")}</a>
      </Link>
    )
  }

  return <div className={styles.loginStatus}>{status}</div>
}

export default LoginStatus
