import { useRouter } from "next/router"
import { FunctionComponent, useEffect } from "react"
import { useUserContext } from "../../context/user-info"
import Spinner from "../Spinner"

/**
This is essentially a wrapper component to conditionally render the
content within only once the user is confirmed to be logged in.

If user is logged out, they will be redirected to login.

TODO: Redirect back upon login completion
*/
const LoginGuard: FunctionComponent = ({ children }) => {
  const user = useUserContext()
  const router = useRouter()

  // Content unsuitable if not logged in, send user to login page
  useEffect(() => {
    if (!user.info && !user.loading) {
      router.push("/login")
    }
  }, [user, router])

  return user.loading || !user.info ? <Spinner size={150} /> : <>{children}</>
}

export default LoginGuard
