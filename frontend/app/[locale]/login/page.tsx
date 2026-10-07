import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { Link } from "src/i18n/navigation"
import { getApiBaseUrl } from "src/utils/api-url"
import { Suspense } from "react"
import Image from "next/image"
import flathubMark from "public/img/logo/flathub-logo-mini.svg"
import Spinner from "src/components/Spinner"
import LoginClient from "./login-client"

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
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ returnTo?: string }>
}) {
  const t = await getTranslations()
  const { locale } = await params
  const { returnTo } = await searchParams
  const returnToQuery = returnTo
    ? `?returnTo=${encodeURIComponent(returnTo)}`
    : ""
  let emailLoginEnabled = false
  try {
    const response = await fetch(`${getApiBaseUrl()}/auth/email/config`, {
      cache: "no-store",
    })
    emailLoginEnabled = response.ok && (await response.json()).enabled === true
  } catch {
    // Keep developer sign-in available if the optional email-login setting
    // cannot be loaded.
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
      <h1 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
        {t("user-login-heading")}
      </h1>
      <p className="mb-8 text-base leading-relaxed text-flathub-sonic-silver dark:text-flathub-gainsborow">
        {t("user-login-intro")}
      </p>
      {emailLoginEnabled ? (
        <Suspense fallback={<Spinner size="m" />}>
          <LoginClient providers={[]} locale={locale} emailForm embedded />
        </Suspense>
      ) : (
        <p
          role="status"
          className="rounded-xl bg-flathub-white p-5 dark:bg-flathub-arsenic"
        >
          {t("user-login-unavailable")}
        </p>
      )}
      <p className="mt-8 border-t border-flathub-gainsborow pt-6 text-center text-sm text-flathub-sonic-silver dark:border-flathub-arsenic dark:text-flathub-gainsborow">
        {t.rich("developer-login-hint-link", {
          link: (chunks) => (
            <Link
              href={`/login/developer${returnToQuery}`}
              className="underline decoration-current/40 underline-offset-4 hover:text-flathub-celestial-blue focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-flathub-celestial-blue"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>
    </main>
  )
}
