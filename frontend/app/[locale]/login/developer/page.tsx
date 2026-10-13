import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import {
  getLoginMethodsAuthLoginGet,
  LoginMethod,
} from "../../../../src/codegen"
import Spinner from "src/components/Spinner"
import LoginClient from "../login-client"
import Image from "next/image"
import flathubMark from "public/img/logo/flathub-logo-mini.svg"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("developer-login-title"),
    robots: { index: false },
  }
}

export default async function DeveloperLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const t = await getTranslations()
  let providers: LoginMethod[]
  let locale: string

  try {
    const response = await getLoginMethodsAuthLoginGet()
    providers = response.data
    const resolvedParams = await params
    locale = resolvedParams.locale
  } catch {
    notFound()
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 py-16 sm:py-24">
      <Image
        src={flathubMark}
        alt=""
        width={42}
        height={40}
        className="mb-5 dark:invert"
      />
      <h1 className="mb-8 text-3xl font-bold tracking-tight sm:text-4xl">
        {t("developer-login-title")}
      </h1>
      <Suspense fallback={<Spinner size="m" />}>
        <LoginClient providers={providers} locale={locale} developerLogin />
      </Suspense>
    </main>
  )
}
