import { useRouter } from "next/router"
import { useEffect } from "react"
import { useUserContext } from "../../context/user-info"
import Spinner from "../Spinner"
import { Trans, useTranslation } from "react-i18next"
import { UserState } from "src/types/Login"
import { UserInfo } from "src/codegen"

/**
This is essentially a wrapper component to conditionally render the
content within only once the user is confirmed to be logged in.

If user is logged out, they will be redirected to login and then back
upon completion (via the URL query string).
*/
const LoginGuard = ({
  children,
  condition,
}: {
  children: React.ReactNode
  condition?: (user: UserInfo) => boolean
}) => {
  const { t } = useTranslation()
  const user = useUserContext()
  const router = useRouter()

  // Content unsuitable if not logged in, send user to login page
  useEffect(() => {
    if (!user.info && !user.loading) {
      // Avoid new entry in history stack to allow backward navigation
      router.replace(`/login?returnTo=${encodeURIComponent(router.asPath)}`)
    }
  }, [user, router])

  if (!user.info && user.loading) {
    return <Spinner size="m" />
  }

  if (condition === undefined || (user.info && condition(user.info))) {
    return <>{children}</>
  }

  return (
    <>
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <h1 className="my-8">{t("whoops")}</h1>
        <p>{t("unauthorized-to-view")}</p>
        <Trans i18nKey={"common:retry-or-go-home"}>
          You might want to retry or go back{" "}
          <a className="no-underline hover:underline" href=".">
            home
          </a>
          .
        </Trans>
      </div>
    </>
  )
}

export default LoginGuard
