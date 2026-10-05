"use client"

import { Permission } from "src/codegen/model/permission"
import AdminLayoutClient from "src/components/AdminLayoutClient"
import PermissionStats from "src/components/moderation/PermissionStats"

export default function PermissionsClient() {
  return (
    <AdminLayoutClient
      condition={(info) =>
        info?.permissions.some(
          (permission) => permission === Permission.moderation,
        )
      }
    >
      <PermissionStats />
    </AdminLayoutClient>
  )
}
