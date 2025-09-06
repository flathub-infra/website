import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { Link } from "src/i18n/navigation"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: t("unauthorized"),
    robots: {
      index: false,
    },
  }
}

export default async function UnauthorizedPage() {
  const t = await getTranslations()

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <h1 className="text-4xl font-extrabold mb-6">{t("whoops")}</h1>
        <p className="text-xl mb-4 text-flathub-sonic-silver dark:text-flathub-gainsborow">
          {t("unauthorized-to-view")}
        </p>
        <p className="mb-8 text-flathub-sonic-silver dark:text-flathub-gainsborow">
          {t("no-permission")}
        </p>
        <Link
          href={`/`}
          className="px-6 py-3 bg-flathub-celestial-blue hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          {t("go-home")}
        </Link>
      </div>
    </div>
  )
}
