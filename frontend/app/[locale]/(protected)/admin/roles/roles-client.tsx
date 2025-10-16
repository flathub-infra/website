"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import React from "react"
import {
  Permission,
  RoleName,
  GetUserinfoAuthUserinfoGet200,
  useRolesUsersRolesGet,
  useRoleUsersUsersRolesRoleNameGet,
} from "src/codegen"
import AdminLayoutClient from "src/components/AdminLayoutClient"
import Spinner from "src/components/Spinner"
import { Link } from "src/i18n/navigation"

export default function RolesClient() {
  const rolesQuery = useRolesUsersRolesGet({
    axios: {
      withCredentials: true,
    },
  })

  return (
    <AdminLayoutClient
      condition={(info: GetUserinfoAuthUserinfoGet200) =>
        info.permissions.some((a) => a === Permission["view-users"])
      }
    >
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <div className="space-y-8">
          <h1 className="mt-8 text-4xl font-extrabold">Users</h1>
          <div className="px-4 sm:px-6 lg:px-8">
            {rolesQuery.isLoading && <Spinner size="m" />}

            {rolesQuery.isSuccess && (
              <div className="flex flex-col gap-4">
                {rolesQuery.data.data.map((role) => (
                  <Card key={role}>
                    <CardHeader>
                      <CardTitle>{role}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <UserList role={role} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayoutClient>
  )
}

const UserList = ({ role }: { role: string }) => {
  const query = useRoleUsersUsersRolesRoleNameGet(role as RoleName, {
    axios: {
      withCredentials: true,
    },
  })

  if (query.isLoading) {
    return <Spinner size="m" />
  }

  return (
    <ul className="space-y-4">
      {query.data.data.map((user) => (
        <li key={user.id}>
          <Link href={`/admin/users/${user.id}`}>
            {user.display_name ?? user.id}
          </Link>
        </li>
      ))}
    </ul>
  )
}
