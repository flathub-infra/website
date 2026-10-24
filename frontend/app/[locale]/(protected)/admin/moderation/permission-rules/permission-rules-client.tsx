"use client"

import { Permission, GetUserinfoAuthUserinfoGet200 } from "src/codegen"
import AdminLayoutClient from "src/components/AdminLayoutClient"
import PermissionRuleList from "src/components/moderation/PermissionRuleList"

export default function PermissionRulesClient() {
  return (
    <AdminLayoutClient
      condition={(info: GetUserinfoAuthUserinfoGet200) =>
        info.permissions.some((a) => a === Permission.moderation)
      }
    >
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <PermissionRuleList />
      </div>
    </AdminLayoutClient>
  )
}
