import { translationMessages } from "i18n/request"
import { GetStaticProps } from "next"
import { NextSeo } from "next-seo"
import { ReactElement } from "react"
import { Permission, UserInfo } from "src/codegen"
import AdminLayout from "src/components/AdminLayout"

Admin.getLayout = function getLayout(page: ReactElement) {
  return (
    <AdminLayout
      condition={(info: UserInfo) =>
        info.permissions.some((a) => a === Permission.moderation) ||
        info.permissions.some((a) => a === Permission["view-users"]) ||
        info.permissions.some((a) => a === Permission["quality-moderation"])
      }
    >
      {page}
    </AdminLayout>
  )
}

export default function Admin() {
  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title="Admin Dashboard" noindex />
      <div className="space-y-8"></div>
    </div>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      messages: await translationMessages(locale),
    },
  }
}
