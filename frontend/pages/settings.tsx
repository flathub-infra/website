import { GetStaticProps } from "next"
import { useTranslations } from "next-intl"

import { NextSeo } from "next-seo"
import LoginGuard from "../src/components/login/LoginGuard"
import DeleteButton from "../src/components/user/DeleteButton"
import UserDetails from "../src/components/user/Details"
import { LoginProvider } from "../src/types/Login"
import { fetchLoginProviders } from "src/fetchers"
import { translationMessages } from "i18n/request"

export default function Settings({
  providers,
}: {
  providers: LoginProvider[]
}) {
  const t = useTranslations()

  return (
    <>
      <NextSeo title={t("settings")} noindex />
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <LoginGuard>
          <div className="mt-4 p-4 flex flex-wrap gap-3 rounded-xl bg-flathub-white shadow-md dark:bg-flathub-arsenic">
            <div className="space-y-3">
              <UserDetails logins={providers} />
              <div className="pt-12">
                <DeleteButton />
              </div>
            </div>
          </div>
        </LoginGuard>
      </div>
    </>
  )
}

// Need available login providers to show options on page
export const getStaticProps: GetStaticProps = async ({
  locale,
}: {
  locale: string
}) => {
  const providers = await fetchLoginProviders()

  return {
    props: {
      messages: await translationMessages(locale),
      providers: providers,
    },
    revalidate: 900,
  }
}
