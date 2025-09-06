"use client"

import { ReactNode, useEffect } from "react"
import { useRouter } from "src/i18n/navigation"
import { useUserContext } from "../../../../src/context/user-info"
import { Permission } from "../../../../src/codegen"
import Spinner from "../../../../src/components/Spinner"

interface AdminLayoutClientProps {
  children: ReactNode
  locale: string
}

export default function AdminLayoutClient({
  children,
  locale,
}: AdminLayoutClientProps) {
  const router = useRouter()
  const user = useUserContext()

  // Check if user has any admin permissions
  const hasAdminAccess = (user: any) => {
    if (!user?.permissions) return false

    const adminPermissions = [
      Permission.moderation,
      Permission["quality-moderation"],
      Permission["view-users"],
      Permission["modify-users"],
    ]

    return adminPermissions.some((permission) =>
      user.permissions.some((p: string) => p === permission),
    )
  }

  useEffect(() => {
    if (!user.loading && user.info && !hasAdminAccess(user.info)) {
      // User is logged in but doesn't have admin permissions
      router.replace(`/${locale}/unauthorized`)
    }
  }, [user, router, locale])

  // Show loading while checking
  if (user.loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner size="m" />
      </div>
    )
  }

  // If user doesn't have admin access, don't render content (redirect is happening)
  if (user.info && !hasAdminAccess(user.info)) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner size="m" />
      </div>
    )
  }

  return <>{children}</>
}
