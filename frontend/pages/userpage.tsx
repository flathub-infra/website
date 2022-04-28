import { GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import LoginGuard from "../src/components/login/LoginGuard"
import UserDetails from "../src/components/user/Details"
import UserApps from "../src/components/user/UserApps"
import { fetchLoginProviders } from "../src/fetchers"
import { LoginProvider } from "../src/types/Login"
import styles from "./userpage.module.scss"

export default function Userpage({ providers }) {
  const { t } = useTranslation()

  // Buttons above apps so they're on screen when page loads (for action visibility)
  return (
    <>
      <NextSeo title={t("user-page")} noindex={true} />
      <div className={styles.userArea}>
        <LoginGuard>
          <UserDetails logins={providers} />
          <UserApps />
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
