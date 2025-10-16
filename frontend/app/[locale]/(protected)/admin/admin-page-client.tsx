"use client"

import AdminLayoutClient from "src/components/AdminLayoutClient"
import { Permission, GetUserinfoAuthUserinfoGet200 } from "src/codegen"

export default function AdminPageClient() {
  return (
    <AdminLayoutClient
      condition={(info: GetUserinfoAuthUserinfoGet200) =>
        info.permissions.some((a) => a === Permission.moderation) ||
        info.permissions.some((a) => a === Permission["view-users"]) ||
        info.permissions.some((a) => a === Permission["quality-moderation"])
      }
    >
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <div className="space-y-8">
          <h1 className="mt-8 text-4xl font-extrabold">Admin Dashboard</h1>
          <p>
            Welcome to the admin dashboard. Select a section from the navigation
            to get started.
          </p>
        </div>
      </div>
    </AdminLayoutClient>
  )
}
