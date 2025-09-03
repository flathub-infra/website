"use client"

import { Permission, UserInfo } from "src/codegen"
import LoginGuard from "src/components/login/LoginGuard"
import AppModeration from "src/components/moderation/AppModeration"

interface AppModerationClientProps {
  appId: string
}

export default function AppModerationClient({
  appId,
}: AppModerationClientProps) {
  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <LoginGuard
        condition={(info: UserInfo) =>
          info.permissions.some((a) => a === Permission.moderation)
        }
      >
        <AppModeration appId={appId} />
      </LoginGuard>
    </div>
  )
}
