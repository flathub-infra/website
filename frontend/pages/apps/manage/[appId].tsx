import { GetStaticPaths, GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { ReactElement } from "react"
import LoginGuard from "../../../src/components/login/LoginGuard"
import { useUserContext } from "../../../src/context/user-info"
import { fetchAppstream } from "../../../src/fetchers"
import { Appstream } from "../../../src/types/Appstream"

export default function AppManagementPage({ app }: { app: Appstream }) {
  const { t } = useTranslation()
  const user = useUserContext()

  let content: ReactElement
  if (user.info?.["dev-flatpaks"].includes(app.id)) {
    content = <p>Owner</p>
  } else {
    content = <p>Unauthorized</p>
  }

  return (
    <div className="max-w-11/12 my-0 mx-auto w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title={t("developer-settings-title", { appname: app.name })} />
      <h2>{t("developer-settings-title", { appname: app.name })}</h2>
      <LoginGuard>{content}</LoginGuard>
    </div>
  )
}

export const getStaticProps: GetStaticProps = async ({
  locale,
  params: { appId },
}) => {
  const app = await fetchAppstream(appId as string)

  return {
    notFound: !app,
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      app,
    },
    revalidate: 3600,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}
