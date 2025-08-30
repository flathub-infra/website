"use client"

import { useTranslations } from "next-intl"
import LoginGuard from "../../../../src/components/login/LoginGuard"
import { Button } from "@/components/ui/button"
import type { JSX } from "react"
import { Link } from "src/i18n/navigation"

const NewAppClient = (): JSX.Element => {
  const t = useTranslations()

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
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

export default NewAppClient
