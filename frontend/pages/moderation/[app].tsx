import { GetStaticPaths, GetStaticProps } from "next"
import { Trans, useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import { ReactElement } from "react"
import Spinner from "src/components/Spinner"
import AppModeration from "src/components/moderation/AppModeration"
import { useUserContext } from "src/context/user-info"

export default function ModerationTabs({ appId }) {
  const { t } = useTranslation()
  const user = useUserContext()
  const router = useRouter()

  let content: ReactElement

  if (!user.info) {
    if (user.loading) {
      content = <Spinner size="m" />
    } else {
      router.replace(`/login?returnTo=${encodeURIComponent(router.asPath)}`)
    }
  } else if (!user.info["is-moderator"]) {
    content = (
      <>
        <h1 className="my-8">{t("whoops")}</h1>
        <p>{t("unauthorized-to-view")}</p>
        <Trans i18nKey={"common:retry-or-go-home"}>
          You might want to retry or go back{" "}
          <a className="no-underline hover:underline" href=".">
            home
          </a>
          .
        </Trans>
      </>
    )
  } else {
    content = <AppModeration appId={appId} />
  }

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title={appId} />
      {content}
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
