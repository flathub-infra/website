import { useEffect } from "react"
import { useUserContext } from "../../context/user-info"
import Spinner from "../Spinner"
import { UserInfo } from "src/codegen"
import { useTranslations } from "next-intl"
import { usePathname, useRouter } from "src/i18n/navigation"

interface ClientAuthGuardProps {
  children: React.ReactNode
  condition?: (user: UserInfo) => boolean | undefined
  fallback?: React.ReactNode
}

/**
 * Simplified client-side auth guard for App Router
 * Prefer server-side protection with route groups and middleware
 */
export default function ClientAuthGuard({
  children,
  condition,
  fallback,
}: ClientAuthGuardProps) {
  const t = useTranslations()
  const user = useUserContext()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!user.info && !user.loading) {
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`)
    }
  }, [user, router, pathname])

  // Show loading state
  if (user.loading) {
    return <Spinner size="m" />
  }

  // User not authenticated
  if (!user.info) {
    return fallback || <Spinner size="m" />
  }

  // User authenticated but doesn't meet condition
  if (condition && !condition(user.info)) {
    return (
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
    )
  }

  return <>{children}</>
}
