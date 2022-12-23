import { useRouter } from "next/router"
import { FunctionComponent, useEffect } from "react"
import { useUserContext } from "../../context/user-info"
import Spinner from "../Spinner"

/**
This is essentially a wrapper component to conditionally render the
content within only once the user is confirmed to be logged in.

If user is logged out, they will be redirected to login and then back
upon completion (via the URL query string).
*/
const LoginGuard = ({ children }: { children: React.ReactNode }) => {
  const user = useUserContext()
  const router = useRouter()

  // Content unsuitable if not logged in, send user to login page
  useEffect(() => {
    if (!user.info && !user.loading) {
      // Avoid new entry in history stack to allow backward navigation
      router.replace(`/login?returnTo=${encodeURIComponent(router.asPath)}`)
    }
  }, [user, router])

  return user.loading || !user.info ? <Spinner size="m" /> : <>{children}</>
}

export default LoginGuard
