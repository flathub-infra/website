import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { translationMessages } from "i18n/request"
import { GetStaticProps } from "next"

import { NextSeo } from "next-seo"
import Link from "next/link"
import React from "react"
import { ReactElement } from "react"
import {
  Permission,
  RoleName,
  UserInfo,
  useRolesUsersRolesGet,
  useRoleUsersUsersRolesRoleNameGet,
} from "src/codegen"
import AdminLayout from "src/components/AdminLayout"
import Spinner from "src/components/Spinner"

UserModeration.getLayout = function getLayout(page: ReactElement) {
  return (
    <AdminLayout
      condition={(info: UserInfo) =>
        info.permissions.some((a) => a === Permission["view-users"])
      }
    >
      {page}
    </AdminLayout>
  )
}

export default function UserModeration() {
  const rolesQuery = useRolesUsersRolesGet({
    axios: {
      withCredentials: true,
    },
  })

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title="Users" noindex />
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

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      messages: await translationMessages(locale),
    },
  }
}
