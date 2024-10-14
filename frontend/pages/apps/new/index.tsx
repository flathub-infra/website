import { GetStaticProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useTranslation } from "next-i18next"
import LoginGuard from "src/components/login/LoginGuard"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function NewAppPage() {
  const { t } = useTranslation()

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title={t("new-app")} noindex />
      <LoginGuard>
        <h1 className="mb-8 mt-8 text-4xl font-extrabold">{t("new-app")}</h1>

        <h2 className="mb-6 mt-12 text-2xl font-bold">
          {t("community-repository")}
        </h2>
        <p>{t("community-repository-description")}</p>
        <Button asChild className="w-full" size="xl">
          <a
            href="https://docs.flathub.org/docs/for-app-authors/submission#how-to-submit-an-app"
            rel="noreferrer"
            target="_blank"
          >
            {t("new-community-repository")}
          </a>
        </Button>

        <h2 className="mb-6 mt-12 text-2xl font-bold">{t("direct-upload")}</h2>
        <p>{t("direct-upload-description")}</p>
        <Button asChild className="w-full" size="xl">
          <Link href="/apps/new/register">{t("new-direct-upload")}</Link>
        </Button>
      </LoginGuard>
    </div>
  )
}

// Need available login providers to show options on page
export const getStaticProps: GetStaticProps = async ({
  locale,
}: {
  locale: string
}) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  }
}
