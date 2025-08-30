"use client"

import { useTranslations } from "next-intl"

export default function ServerErrorClient() {
  const t = useTranslations()

  return (
    <div className="max-w-11/12 sm:w-max-1/2 mx-auto my-0 mt-12 w-11/12 sm:w-1/2 2xl:w-[900px] 2xl:max-w-[900px]">
      <h1 className="mb-8 text-4xl font-extrabold">{t("whoops")}</h1>
      <p>{t("an-error-occurred-server", { errorCode: "500" })}</p>
      <p>
        {t.rich("retry-or-go-home", {
          link: (chunk) => (
            <a className="no-underline hover:underline" href=".">
              {chunk}
            </a>
          ),
        })}
      </p>
    </div>
  )
}
