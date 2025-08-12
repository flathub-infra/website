import { useTranslations } from "next-intl"
import { FunctionComponent } from "react"
import { NextSeo } from "next-seo"
import React from "react"
import { HiOutlineExclamationTriangle } from "react-icons/hi2"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface Props {
  message: string
}

const EolMessage: FunctionComponent<Props> = ({ message }) => {
  const t = useTranslations()

  return (
    <>
      <NextSeo noindex />
      <div className="mt-8 flex max-w-full flex-col px-[5%] md:px-[20%] 2xl:px-[30%]">
        <Alert>
          <HiOutlineExclamationTriangle className="h-4 w-4" />
          <AlertTitle>{t("app-eol")}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      </div>
    </>
  )
}

export default EolMessage
