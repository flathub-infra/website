import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { fetchLoginProviders } from "../../../src/fetchers"
import LoginClient from "./login-client"

export async function generateStaticParams() {
  return []
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

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

    return (
      <Suspense fallback={<div>Loading...</div>}>
        <LoginClient providers={providers} locale={locale} />
      </Suspense>
    )
  } catch (error) {
    notFound()
  }
}
