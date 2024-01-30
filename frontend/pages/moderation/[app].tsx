import { GetStaticPaths, GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { UserInfo } from "src/codegen"
import LoginGuard from "src/components/login/LoginGuard"
import AppModeration from "src/components/moderation/AppModeration"

export default function ModerationTabs({ appId }) {
  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title={appId} />
      <LoginGuard condition={(info: UserInfo) => info.is_moderator}>
        <AppModeration appId={appId} />
      </LoginGuard>
    </div>
  )
}

export const getStaticProps: GetStaticProps = async ({
  locale,
  params: { app },
}) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      appId: app,
    },
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}
