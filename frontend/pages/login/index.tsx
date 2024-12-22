import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import Router from "next/router"
import { useEffect } from "react"
import LoginProviders from "../../src/components/login/Providers"
import { useUserContext } from "../../src/context/user-info"
import { useTranslation } from "next-i18next"
import { getLoginMethodsAuthLoginGet } from "src/codegen"

export default function LoginPortal({ providers, locale }) {
  const { t } = useTranslation()
  const user = useUserContext()

  // Set NEXT_LOCALE cookie to match locale of this page
  useEffect(() => {
    if (!locale) return
    document.cookie = `NEXT_LOCALE=${locale};path=/;SameSite=Strict`
  }, [locale])

  useEffect(() => {
    // Already logged in, just redirect to userpage
    if (user.info && !user.loading) {
      Router.replace("/")
    }
  }, [user])

  return (
    <>
      <NextSeo
        title={t("login")}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/login`,
        }}
      />
      <LoginProviders providers={providers} />
    </>
  )
}

// Providers won't change often so fetch at build time for now
export const getStaticProps: GetStaticProps = async ({
  locale,
}: {
  locale: string
}) => {
  const providers = await getLoginMethodsAuthLoginGet()

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      providers: providers.data,
      locale,
    },
  }
}
