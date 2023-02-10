import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import { NextSeo } from "next-seo"
import React from "react"

interface Props {
  message: string
}

const EolMessage: FunctionComponent<Props> = ({ message }) => {
  const { t } = useTranslation()

  return (
    <>
      <NextSeo noindex={true} />
      <div className="grid h-screen place-items-center justify-center">
        <span className="text-center">
          <p>{t("app-eol")}</p>
          <p>{message}</p>
        </span>
      </div>
    </>
  )
}

export default EolMessage
