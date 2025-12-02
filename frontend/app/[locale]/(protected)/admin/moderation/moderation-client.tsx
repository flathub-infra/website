"use client"

import { Permission, GetUserinfoAuthUserinfoGet200 } from "src/codegen"
import AdminLayoutClient from "src/components/AdminLayoutClient"
import ModerationTabs from "src/components/moderation/ModerationTabs"

export default function ModerationClient() {
  return (
    <AdminLayoutClient
      condition={(info: GetUserinfoAuthUserinfoGet200) =>
        info.permissions.some((a) => a === Permission.moderation)
      }
    >
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <div className="space-y-10 py-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight">
              Pending Reviews
            </h1>
            <p className="text-base text-flathub-sonic-silver dark:text-flathub-spanish-gray">
              Review and moderate app submissions and updates
            </p>
          </div>
          <ModerationTabs />
        </div>
      </div>
    </AdminLayoutClient>
  )
}
