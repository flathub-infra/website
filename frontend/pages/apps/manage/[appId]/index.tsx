import { GetStaticPaths, GetStaticProps } from "next"
import { Trans, useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { ReactElement, useCallback } from "react"
import * as AppVerificationControls from "src/components/application/AppVerificationControls"
import * as AppVendingControls from "../../../../src/components/application/AppVendingControls"
import LoginGuard from "../../../../src/components/login/LoginGuard"
import { useUserContext } from "../../../../src/context/user-info"
import { fetchAppstream, fetchVendingConfig } from "../../../../src/fetchers"
import { Appstream } from "../../../../src/types/Appstream"
import { VendingConfig } from "../../../../src/types/Vending"
import { IS_PRODUCTION } from "src/env"
import Tabs from "src/components/Tabs"
import { AppDevModeration } from "src/components/moderation/AppDevModeration"
import AppDevelopersControls from "src/components/application/AppDevelopersControls"
import { getInviteStatus } from "src/asyncs/directUpload"
import { useAsync } from "src/hooks/useAsync"

export default function AppManagementPage({
  app,
  vendingConfig,
}: {
  app: Appstream
  vendingConfig: VendingConfig
}) {
  const { t } = useTranslation()
  const user = useUserContext()

  const tabs = [
    {
      name: t("verification"),
      content: (
        <AppVerificationControls.AppVerificationSetup
          app={app}
          isNewApp={false}
        />
      ),
    },
  ]

  const { value: inviteStatus } = useAsync(
    useCallback(async () => await getInviteStatus(app.id), [app.id]),
  )

  if (!IS_PRODUCTION) {
    tabs.push(
      {
        name: t("payment"),
        content: (
          <AppVendingControls.SetupControls
            app={app}
            vendingConfig={vendingConfig}
          />
        ),
      },
      {
        name: t("ownership-tokens"),
        content: <AppVendingControls.OwnershipTokens app={app} />,
      },
      {
        name: t("moderation-pending-reviews"),
        content: <AppDevModeration app={app} />,
      },
    )

    if (inviteStatus) {
      tabs.push({
        name: t("developers"),
        content: <AppDevelopersControls app={app} />,
      })
    }
  }

  // User must be a developer of the app to see these controls
  let content: ReactElement
  if (user.info?.["dev-flatpaks"].includes(app.id)) {
    content = (
      <>
        <div className="space-y-8">
          <div>
            <h1 className="mt-8 text-4xl font-extrabold">{app.name}</h1>
            <div className="text-sm opacity-75">{t("developer-settings")}</div>
          </div>
          <div>
            <Tabs tabs={tabs} />
          </div>
        </div>
      </>
    )
  } else {
    content = (
      <>
        <h1 className="my-8 text-4xl font-extrabold">{t("whoops")}</h1>
        <p>{t("unauthorized-to-view")}</p>
        <Trans i18nKey={"common:retry-or-go-home"}>
          You might want to retry or go back{" "}
          <a className="no-underline hover:underline" href=".">
            home
          </a>
          .
        </Trans>{" "}
      </>
    )
  }

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title={t(app.name)} noindex />
      <LoginGuard>{content}</LoginGuard>
    </div>
  )
}

export const getStaticProps: GetStaticProps = async ({
  locale,
  params: { appId },
}) => {
  const [{ data: app }, { data: vendingConfig }] = await Promise.all([
    fetchAppstream(appId as string),
    fetchVendingConfig(),
  ])

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      app: app ?? { id: appId, name: appId },
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
