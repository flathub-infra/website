import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import Spinner from "src/components/Spinner"
import { getApiBaseUrl } from "src/utils/api-url"
import LoginClient from "../login-client"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("email-login-with-email"),
    robots: {
      index: false,
      follow: false,
    },
  }
}

export default async function EmailLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  let enabled = false
  try {
    const response = await fetch(`${getApiBaseUrl()}/auth/email/config`, {
      cache: "no-store",
    })
    enabled = response.ok && (await response.json()).enabled === true
  } catch {
    notFound()
  }
  if (!enabled) notFound()

  const { locale } = await params
  return (
    <Suspense fallback={<Spinner size={"m"} />}>
      <LoginClient providers={[]} locale={locale} emailForm />
    </Suspense>
  )
}
