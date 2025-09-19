import { useTranslations } from "next-intl"
import { Link } from "src/i18n/navigation"

export default function NotFoundPage() {
  const t = useTranslations()

  return (
    <div className="max-w-11/12 sm:w-max-1/2 mx-auto my-0 mt-12 w-11/12 sm:w-1/2 2xl:w-[900px] 2xl:max-w-[900px]">
      <h1 className="mb-8 text-4xl font-extrabold">
        {t("page-not-found", { errorCode: "404" })}
      </h1>
      <p>{t("could-not-find-page")}</p>
      <p>
        {t.rich("retry-or-go-home", {
          link: (chunk: any) => (
            <Link className="no-underline hover:underline" href="/">
              {chunk}
            </Link>
          ),
        })}
      </p>
    </div>
  )
}
