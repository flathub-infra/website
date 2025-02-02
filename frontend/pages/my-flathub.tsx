import { GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import LoginGuard from "../src/components/login/LoginGuard"
import UserApps from "../src/components/user/UserApps"
import { IS_PRODUCTION } from "src/env"
import Breadcrumbs from "src/components/Breadcrumbs"
import ApplicationCollection from "src/components/application/Collection"
import { useGetFavoritesFavoritesGet } from "src/codegen"
import Spinner from "src/components/Spinner"
import { getAppsInfo } from "src/asyncs/app"
import { useQuery } from "@tanstack/react-query"

const FavoriteApps = ({ locale }: { locale: string }) => {
  const { t } = useTranslation()

  const favoritesQuery = useGetFavoritesFavoritesGet({
    axios: {
      withCredentials: true,
    },
  })

  const appdetailQuery = useQuery({
    queryKey: ["favorite-apps", locale],
    queryFn: async () => {
      const data = await getAppsInfo(
        favoritesQuery.data.data.map((app) => app.app_id),
        locale,
      )
      return data
    },
    enabled: !!favoritesQuery.data,
  })

  if (appdetailQuery.isLoading || favoritesQuery.isLoading) {
    return <Spinner size="m" />
  }

  return (
    <ApplicationCollection
      title={t("favorite-apps")}
      applications={appdetailQuery.data}
      variant="nested"
    />
  )
}

export default function MyFlathub({ locale }: { locale: string }) {
  const { t } = useTranslation()

  const pages = [{ name: t("my-flathub"), current: true, href: "/my-flathub" }]

  return (
    <>
      <NextSeo title={t("my-flathub")} noindex />
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <LoginGuard>
          <div className="space-y-12">
            <Breadcrumbs pages={pages} />
            <div className="mt-4 p-4 flex flex-wrap gap-3 rounded-xl bg-flathub-white shadow-md dark:bg-flathub-arsenic">
              <>
                <h1 className="text-4xl font-extrabold">{t("my-flathub")}</h1>
                <div className="space-y-12 w-full">
                  {!IS_PRODUCTION && (
                    <>
                      <UserApps variant="owned" locale={locale} />
                      <FavoriteApps locale={locale} />
                    </>
                  )}
                  {IS_PRODUCTION && (
                    <>
                      <FavoriteApps locale={locale} />
                    </>
                  )}
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
