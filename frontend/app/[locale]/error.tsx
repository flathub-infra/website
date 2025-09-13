"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Metadata } from "next"

import * as Sentry from "@sentry/nextjs"

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("server-error"),
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default function Error({ error, reset }: Props) {
  const t = useTranslations()

  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="max-w-11/12 sm:w-max-1/2 mx-auto my-0 mt-12 w-11/12 sm:w-1/2 2xl:w-[900px] 2xl:max-w-[900px]">
      <h1 className="mb-8 text-4xl font-extrabold">{t("whoops")}</h1>
      <p>{t("an-error-occurred-server", { errorCode: "500" })}</p>
      <p>
        {t.rich("retry-or-go-home", {
          link: (chunk: any) => (
            <a className="no-underline hover:underline" href=".">
              {chunk}
            </a>
          ),
        })}
      </p>
      <div className="mt-4">
        <button
          className="rounded bg-flathub-celestial-blue px-4 py-2 text-white hover:bg-flathub-celestial-blue-dark"
          onClick={reset}
        >
          {t("try-again")}
        </button>
      </div>
    </div>
  )
}
