import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { getLoginMethodsAuthLoginGet, LoginMethod } from "../../../src/codegen"
import LoginClient from "./login-client"
import Spinner from "src/components/Spinner"

export const revalidate = 86400

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
  let providers: LoginMethod[]
  let locale: string

  try {
    const response = await getLoginMethodsAuthLoginGet()
    providers = response.data
    const resolvedParams = await params
    locale = resolvedParams.locale
  } catch (error) {
    notFound()
  }

  return (
    <Suspense fallback={<Spinner size={"m"} />}>
      <LoginClient providers={providers} locale={locale} />
    </Suspense>
  )
}
