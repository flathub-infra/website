import { Metadata } from "next"
import AdminLayoutClient from "src/components/AdminLayoutClient"
import { Permission, UserInfo } from "src/codegen"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  return {
    title: "Admin Dashboard",
    robots: {
      index: false,
    },
  }
}

export default async function AdminPage() {
  return (
    <AdminLayoutClient
      condition={(info: UserInfo) =>
        info.permissions.some((a) => a === Permission.moderation) ||
        info.permissions.some((a) => a === Permission["view-users"]) ||
        info.permissions.some((a) => a === Permission["quality-moderation"])
      }
    >
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <div className="space-y-8"></div>
      </div>
    </AdminLayoutClient>
  )
}
