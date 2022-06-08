import { GetStaticPaths, GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import LoginGuard from "../../../src/components/login/LoginGuard"
import PurchaseInput from "../../../src/components/payment/PurchaseInput"
import { fetchAppstream } from "../../../src/fetchers"
import { Appstream } from "../../../src/types/Appstream"

export default function AppPurchasePage({ app }: { app: Appstream }) {
  return (
    <div className="max-w-11/12 my-0 mx-auto w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title={app?.name} />
      <LoginGuard>
        <PurchaseInput appId={app.id} />
      </LoginGuard>
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
