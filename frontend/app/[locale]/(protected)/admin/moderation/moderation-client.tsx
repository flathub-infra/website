"use client"

import { Permission, UserInfo } from "src/codegen"
import AdminLayoutClient from "src/components/AdminLayoutClient"
import ModerationTabs from "src/components/moderation/ModerationTabs"

export default function ModerationClient() {
  return (
    <AdminLayoutClient
      condition={(info: UserInfo) =>
        info.permissions.some((a) => a === Permission.moderation)
      }
    >
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <div className="space-y-8">
          <h1 className="mt-8 text-4xl font-extrabold">Pending Reviews</h1>
          <ModerationTabs />
        </div>
      </div>
    </AdminLayoutClient>
  )
}
