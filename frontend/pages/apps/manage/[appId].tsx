import { GetStaticPaths, GetStaticProps } from "next"
import { Trans, useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { ReactElement } from "react"
import * as AppVerificationControls from "src/components/application/AppVerificationControls"
import * as AppVendingControls from "../../../src/components/application/AppVendingControls"
import LoginGuard from "../../../src/components/login/LoginGuard"
import { useUserContext } from "../../../src/context/user-info"
import { fetchAppstream, fetchVendingConfig } from "../../../src/fetchers"
import { Appstream } from "../../../src/types/Appstream"
import { VendingConfig } from "../../../src/types/Vending"
import { IS_PRODUCTION } from "src/env"

export default function AppManagementPage({
  app,
  vendingConfig,
}: {
  app: Appstream
  vendingConfig: VendingConfig
}) {
  const { t } = useTranslation()
  const user = useUserContext()

  // User must be a developer of the app to see these controls
  let content: ReactElement
  if (user.info?.["dev-flatpaks"].includes(app.id)) {
    content = (
      <>
        <h1 className="mt-8">{app.name}</h1>
        <div className="text-sm opacity-75">{t("developer-settings")}</div>
        <AppVerificationControls.SetupControls app={app} />
        {!IS_PRODUCTION && (
          <AppVendingControls.SetupControls
            app={app}
            vendingConfig={vendingConfig}
          />
        )}
        {!IS_PRODUCTION && <AppVendingControls.OwnershipTokens app={app} />}
      </>
    )
  } else {
    content = (
      <>
        <h1 className="my-8">{t("whoops")}</h1>
        <p>{t("unauthorized-to-view")}</p>
        <Trans i18nKey={"common:retry-or-go-home"}>
          You might want to retry or go back <a href=".">home</a>.
        </Trans>{" "}
      </>
    )
  }

  return (
    <div className="max-w-11/12 my-0 mx-auto w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title={t(app.name)} />
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
    notFound: !app,
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      app,
      vendingConfig,
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
