"use client"

import { ReactNode, useEffect } from "react"
import { useRouter, usePathname } from "src/i18n/navigation"
import { useUserContext } from "../../../src/context/user-info"
import { UserInfo } from "../../../src/codegen"
import Spinner from "../../../src/components/Spinner"

interface ProtectedLayoutClientProps {
  children: ReactNode
  locale: string
  serverUser: UserInfo | null
}

export default function ProtectedLayoutClient({
  children,
  locale,
  serverUser,
}: ProtectedLayoutClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const user = useUserContext()

  useEffect(() => {
    // If server-side couldn't get user info, fall back to client-side check
    if (!serverUser && !user.info && !user.loading) {
      // Redirect to login with return URL
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`)
    }
  }, [serverUser, user, router, pathname])

  // Show loading while checking authentication
  if (!serverUser && user.loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner size="m" />
      </div>
    )
  }

  // If neither server nor client has user info, don't render (redirect is happening)
  if (!serverUser && !user.info) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner size="m" />
      </div>
    )
  }

  return <>{children}</>
}
