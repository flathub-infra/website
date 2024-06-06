import { GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import LoginGuard from "../src/components/login/LoginGuard"
import UserApps from "../src/components/user/UserApps"
import { IS_PRODUCTION } from "src/env"
import { HiSparkles } from "react-icons/hi2"
import Breadcrumbs from "src/components/Breadcrumbs"

const Empty = () => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col">
      <div className="bg-flathub-celestial-blue rounded-full m-auto p-3">
        <HiSparkles />
      </div>
      <span className="m-auto">{t("nothing-to-do")}</span>
    </div>
  )
}

export default function MyFlathub({ locale }: { locale: string }) {
  const { t } = useTranslation()

  const pages = [{ name: t("my-flathub"), current: true, href: "/my-flathub" }]

  return (
    <>
      <NextSeo title={t("my-flathub")} noindex={true} />
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <LoginGuard>
          <div className="space-y-12">
            <Breadcrumbs pages={pages} />
            <div className="mt-4 p-4 flex flex-wrap gap-3 rounded-xl bg-flathub-white shadow-md dark:bg-flathub-arsenic">
              <>
                <h1 className="text-4xl font-extrabold">{t("my-flathub")}</h1>
                <div className="space-y-12 w-full">
                  {!IS_PRODUCTION && (
                    <UserApps variant="owned" locale={locale} />
                  )}
                  {IS_PRODUCTION && <Empty />}
                </div>
              </>
            </div>
          </div>
        </LoginGuard>
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({
  locale,
}: {
  locale: string
}) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      locale,
    },
    revalidate: 900,
  }
}
