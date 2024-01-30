import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { UserInfo } from "src/codegen"
import LoginGuard from "src/components/login/LoginGuard"
import ModerationTabs from "src/components/moderation/ModerationTabs"

export default function ModerationDashboard() {
  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title="Moderation Dashboard" noindex />
      <LoginGuard condition={(info: UserInfo) => info.is_moderator}>
        <div className="space-y-8">
          <h1 className="mt-8 text-4xl font-extrabold">Pending Reviews</h1>
          <ModerationTabs />
        </div>
      </LoginGuard>
    </div>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  }
}
