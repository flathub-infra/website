import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { getLoginMethodsAuthLoginGet } from "../../../../src/codegen"
import LoginServiceClient from "./login-service-client"
import Spinner from "src/components/Spinner"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("login"),
    robots: {
      index: false,
      follow: false,
    },
  }
}

export async function generateStaticParams() {
  try {
    const providers = await getLoginMethodsAuthLoginGet()
    const services = providers.data.map((d) => d.method)

    return services.map((service: string) => ({
      service,
    }))
  } catch (error) {
    return []
  }
}

export default async function LoginServicePage() {
  let services: string[]

  try {
    const providers = await getLoginMethodsAuthLoginGet()
    services = providers.data.map((d) => d.method)
  } catch (error) {
    notFound()
  }

  return (
    <Suspense fallback={<Spinner size={"m"} />}>
      <LoginServiceClient services={services} />
    </Suspense>
  )
}
