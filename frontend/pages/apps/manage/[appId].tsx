import { GetStaticPaths, GetStaticProps } from "next"
import { Trans, useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { ReactElement } from "react"
import * as AppVendingControls from "../../../src/components/application/AppVendingControls"
import LoginGuard from "../../../src/components/login/LoginGuard"
import { useUserContext } from "../../../src/context/user-info"
import { fetchAppstream, fetchVendingConfig } from "../../../src/fetchers"
import { Appstream } from "../../../src/types/Appstream"
import { VendingConfig } from "../../../src/types/Vending"

export default function AppManagementPage({
  appId,
  app,
  vendingConfig,
}: {
  appId: string
  app?: Appstream
  vendingConfig: VendingConfig
}) {
  const { t } = useTranslation()
  const user = useUserContext()

  const appname = app?.name ?? appId

  // User must be a developer of the app to see these controls
  let content: ReactElement
  if (user.info?.["dev-flatpaks"].includes(appId)) {
    content = (
      <>
        <h2>{t("developer-settings-title", { appname })}</h2>
        <AppVendingControls.SetupControls
          appId={appId}
          app={app}
          vendingConfig={vendingConfig}
        />
        <AppVendingControls.OwnershipTokens appId={appId} />
      </>
    )
  } else {
    content = (
      <>
        <h1>{t("whoops")}</h1>
        <p>{t("unauthorized-to-view")}</p>
        <Trans i18nKey={"common:retry-or-go-home"}>
          You might want to retry or go back <a href=".">home</a>.
        </Trans>{" "}
      </>
    )
  }

  return (
    <div className="max-w-11/12 my-0 mx-auto w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title={t("developer-settings-title", { appname })} />
      <LoginGuard>{content}</LoginGuard>
    </div>
  )
}

export const getStaticProps: GetStaticProps = async ({
  locale,
  params: { appId },
}) => {
  const [app, vendingConfig] = await Promise.all([
    fetchAppstream(appId as string),
    fetchVendingConfig(),
  ])

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      appId,
      app,
      vendingConfig: vendingConfig ?? null,
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
