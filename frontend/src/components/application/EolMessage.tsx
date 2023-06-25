import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import { NextSeo } from "next-seo"
import React from "react"
import { HiExclamationTriangle } from "react-icons/hi2"
import Alert from "../Alert"

interface Props {
  message: string
}

const EolMessage: FunctionComponent<Props> = ({ message }) => {
  const { t } = useTranslation()

  return (
    <>
      <NextSeo noindex={true} />
      <div className="mt-8 flex max-w-full flex-col px-[5%] md:px-[20%] 2xl:px-[30%]">
        <Alert
          type="warning"
          icon={HiExclamationTriangle}
          headline={t("app-eol")}
          message={message}
        />
      </div>
    </>
  )
}

export default EolMessage
