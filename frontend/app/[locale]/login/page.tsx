import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import { fetchLoginProviders } from "../../../src/fetchers"
import LoginClient from "./login-client"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale })

  return {
    title: t("login"),
    robots: {
      index: false,
    },
  }
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  try {
    const providers = await fetchLoginProviders()
    const { locale } = await params

    // Enable static rendering
    setRequestLocale(locale)

    return (
      <Suspense fallback={<div>Loading...</div>}>
        <LoginClient providers={providers} locale={locale} />
      </Suspense>
    )
  } catch (error) {
    notFound()
  }
}
