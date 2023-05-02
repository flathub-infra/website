import { Trans, useTranslation } from "next-i18next"
import { NextSeo } from "next-seo"

export const Error = () => {
  const { t } = useTranslation()
  return (
    <>
      <NextSeo title={t("something-went-wrong")} />
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <h1 className="my-8">{t("whoops")}</h1>
        <p>{t("something-went-wrong")}</p>
        <p>
          <Trans i18nKey={"common:retry-or-go-home"}>
            You might want to retry or go back{" "}
            <a className="no-underline hover:underline" href=".">
              home
            </a>
            .
          </Trans>
        </p>
      </div>
    </>
  )
}
