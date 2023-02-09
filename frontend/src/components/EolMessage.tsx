import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import React from "react"

interface Props {
  message: string
}

const EolMessage: FunctionComponent<Props> = ({ message }) => {
  const { t } = useTranslation()

  return (
    <div className="grid h-screen place-items-center justify-center">
      <span className="text-center">
        <span>{t("app-eol")}</span>
        <br />
        <br />
        <span>{message}</span>
      </span>
    </div>
  )
}

export default EolMessage
