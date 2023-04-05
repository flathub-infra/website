import { GetStaticPaths, GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import * as AppVendingControls from "../../../src/components/application/AppVendingControls"
import LoginGuard from "../../../src/components/login/LoginGuard"
import { fetchAppstream, fetchVendingConfig } from "../../../src/fetchers"
import { Appstream } from "../../../src/types/Appstream"
import { VendingConfig } from "../../../src/types/Vending"

export default function AppPurchasePage({
  app,
  vendingConfig,
}: {
  app: Appstream
  vendingConfig: VendingConfig
}) {
  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title={app?.name} />
      <LoginGuard>
        <AppVendingControls.PurchaseControls
          app={app}
          vendingConfig={vendingConfig}
        />
        <AppVendingControls.OwnershipTokenRedeemDialog app={app} />
      </LoginGuard>
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
