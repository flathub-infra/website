import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Suspense } from "react"
import { getLoginMethodsAuthLoginGet } from "../../../src/codegen"
import LoginClient from "./login-client"
import Spinner from "src/components/Spinner"

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
  const { locale } = await params

  // Enable static rendering
  setRequestLocale(locale)

  let providers
  try {
    const response = await getLoginMethodsAuthLoginGet()
    providers = response.data
  } catch (error) {
    notFound()
    return null
  }

  return (
    <Suspense fallback={<Spinner size={"m"} />}>
      <LoginClient providers={providers} locale={locale} />
    </Suspense>
  )
}
