import { useTranslations } from "next-intl"
import { FunctionComponent } from "react"
import React from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { TriangleAlertIcon } from "lucide-react"

interface Props {
  message: string
}

const EolMessage: FunctionComponent<Props> = ({ message }) => {
  const t = useTranslations()

  return (
    <>
      <div className="mt-8 flex max-w-full flex-col px-[5%] md:px-[20%] 2xl:px-[30%]">
        <Alert>
          <TriangleAlertIcon className="size-5" />
          <AlertTitle>{t("app-eol")}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      </div>
    </>
  )
}

export default EolMessage
