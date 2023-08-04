import { GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import LoginGuard from "../src/components/login/LoginGuard"
import DeleteButton from "../src/components/user/DeleteButton"
import UserDetails from "../src/components/user/Details"
import UserApps from "../src/components/user/UserApps"
import { fetchLoginProviders } from "../src/fetchers"
import { LoginProvider } from "../src/types/Login"
import { IS_PRODUCTION } from "src/env"
import Tabs from "src/components/Tabs"
import VendingLink from "src/components/user/VendingLink"
import { useUserContext } from "src/context/user-info"
import { useRouter } from "next/router"
import ButtonLink from "src/components/ButtonLink"

export default function Userpage({
  providers,
}: {
  providers: LoginProvider[]
}) {
  const { t } = useTranslation()
  const user = useUserContext()
  const router = useRouter()

  if (!router.isReady || user.loading) {
    return null
  }

  // Nothing to show if not logged in
  if (!user.info && !user.loading) {
    router.push("/login", undefined, { locale: router.locale })
    return null
  }

  const tabs = [
    {
      name: t("developers"),
      content: (
        <>
          <div className="space-y-12">
            <UserApps variant="dev" />

            {!IS_PRODUCTION && user.info["dev-flatpaks"].length ? (
              <div className="mx-2 my-auto">
                <h3 className="my-4 text-xl font-semibold">
                  {t("accepting-payment")}
                </h3>
                <VendingLink />
              </div>
            ) : (
              <></>
            )}
          </div>
        </>
      ),
    },
    {
      name: t("settings"),
      content: (
        <div className="space-y-3">
          <UserDetails logins={providers} />
          <div className="pt-12">
            <DeleteButton />
          </div>
        </div>
      ),
    },
  ]

  if (!IS_PRODUCTION) {
    tabs.unshift({
      name: t("my-flathub"),
      content: <UserApps variant="owned" />,
    })
  }

  // Buttons above apps so they're on screen when page loads (for action visibility)
  return (
    <>
      <NextSeo title={t("my-flathub")} noindex={true} />
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <LoginGuard>
          <div className="mt-4">
            <Tabs tabs={tabs} />
          </div>
        </LoginGuard>
      </div>
    </>
  )
}

// Need available login providers to show options on page
export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const providers: LoginProvider[] = await fetchLoginProviders()

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      providers,
    },
  }
}
