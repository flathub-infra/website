import { GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import LoginGuard from "../src/components/login/LoginGuard"
import DonationInput from "../src/components/payment/DonationInput"

export default function Donate() {
  const { t } = useTranslation()

  return (
    <>
      <NextSeo
        title={t("donate-to", { project: "Flathub" })}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/donate`,
        }}
      />
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <LoginGuard>
          <h2>{t("donate-to", { project: "Flathub" })}</h2>
          <DonationInput org="org.flathub.Flathub" />
        </LoginGuard>
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
    revalidate: 900,
  }
}
