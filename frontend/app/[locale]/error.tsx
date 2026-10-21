"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"
import { Link } from "src/i18n/navigation"
import { Button } from "@/components/ui/button"

import * as Sentry from "@sentry/nextjs"

interface Props {
  error: Error & { digest?: string }
  retry: () => void
}

export default function Error({ error, retry }: Props) {
  const t = useTranslations()

  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="max-w-11/12 sm:w-max-1/2 mx-auto my-0 mt-12 w-11/12 sm:w-1/2 2xl:w-[900px] 2xl:max-w-[900px]">
      <title>{t("server-error")}</title>
      <meta name="robots" content="noindex, nofollow" />
      <h1 className="mb-8 text-4xl font-extrabold">{t("whoops")}</h1>
      <p>{t("an-error-occurred-server", { errorCode: "500" })}</p>
      <p>
        {t.rich("retry-or-go-home", {
          link: (chunk) => (
            <Link className="no-underline hover:underline" href="/">
              {chunk}
            </Link>
          ),
        })}
      </p>
      <div className="mt-4">
        <Button onClick={retry}>{t("try-again")}</Button>
      </div>
    </div>
  )
}
