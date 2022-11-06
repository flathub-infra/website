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

export default function Userpage({
  providers,
}: {
  providers: LoginProvider[]
}) {
  const { t } = useTranslation()

  // Buttons above apps so they're on screen when page loads (for action visibility)
  return (
    <>
      <NextSeo title={t("user-page")} noindex={true} />
      <div className="max-w-11/12 my-0 mx-auto flex w-11/12 flex-col gap-y-4 p-3 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <LoginGuard>
          <UserDetails logins={providers} />
          <UserApps variant="owned" />
          <UserApps variant="dev" />
          <div className="rounded-xl bg-bgColorSecondary p-4 shadow-md">
            <DeleteButton />
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
