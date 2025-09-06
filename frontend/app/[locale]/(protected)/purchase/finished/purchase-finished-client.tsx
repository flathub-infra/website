"use client"

import { useTranslations } from "next-intl"

export default function PurchaseFinishedClient() {
  const t = useTranslations()

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <h1 className="my-8 text-4xl font-extrabold">
        {t("thank-you-for-your-purchase")}
      </h1>
      {t("safe-to-close-page")}
    </div>
  )
}
