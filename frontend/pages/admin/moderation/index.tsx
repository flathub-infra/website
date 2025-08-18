import { translationMessages } from "i18n/request"
import { GetStaticProps } from "next"

import { NextSeo } from "next-seo"
import { ReactElement } from "react"
import { Permission, UserInfo } from "src/codegen"
import AdminLayout from "src/components/AdminLayout"
import ModerationTabs from "src/components/moderation/ModerationTabs"

ModerationDashboard.getLayout = function getLayout(page: ReactElement) {
  return (
    <AdminLayout
      condition={(info: UserInfo) =>
        info.permissions.some((a) => a === Permission.moderation)
      }
    >
      {page}
    </AdminLayout>
  )
}

export default function ModerationDashboard() {
  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title="Moderation" noindex />
      <div className="space-y-8">
        <h1 className="mt-8 text-4xl font-extrabold">Pending Reviews</h1>
        <ModerationTabs />
      </div>
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
