import { useEffect } from "react"
import { useUserContext } from "../../context/user-info"
import Spinner from "../Spinner"
import { UserInfo } from "src/codegen"
import { useTranslations } from "next-intl"
import { usePathname, useRouter } from "src/i18n/navigation"

const LoginGuard = ({
  children,
  condition,
}: {
  children: React.ReactNode
  condition?: (user: UserInfo) => boolean | undefined
}) => {
  const t = useTranslations()
  const user = useUserContext()
  const router = useRouter()
  const pathname = usePathname()

  // Content unsuitable if not logged in, send user to login page
  useEffect(() => {
    if (!user.info && !user.loading) {
      // Avoid new entry in history stack to allow backward navigation
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`)
    }
  }, [user, router, pathname])

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
        {t.rich("retry-or-go-home", {
          link: (chunk) => (
            <a className="no-underline hover:underline" href=".">
              {chunk}
            </a>
          ),
        })}
      </div>
    </>
  )
}

export default LoginGuard
