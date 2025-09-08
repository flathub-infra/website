import { translationMessages } from "i18n/request"
import { GetStaticPaths, GetStaticProps } from "next"
import { NextSeo } from "next-seo"
import { Permission, UserInfo } from "src/codegen"
import LoginGuard from "src/components/login/LoginGuard"
import AppModeration from "src/components/moderation/AppModeration"

export default function ModerationTabs({ appId }) {
  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title={appId} noindex />
      <LoginGuard
        condition={(info: UserInfo) =>
          info.permissions.some((a) => a === Permission.moderation)
        }
      >
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
      messages: await translationMessages(locale),
      appId: app,
    },
    revalidate: 900,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}
