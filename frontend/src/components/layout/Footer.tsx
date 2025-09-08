import { useTranslations } from "next-intl"
import { Link } from "src/i18n/navigation"

const Footer = () => {
  const t = useTranslations()

  return (
    <footer className="mt-16 bg-flathub-white p-12 shadow-md dark:bg-flathub-arsenic">
      <div className="mx-auto gap-5 grid max-w-[900px] grid-cols-1 justify-items-center sm:justify-items-start sm:grid-cols-2 md:grid-cols-4">
        <div>
          <div className="flex justify-center text-2xl font-bold sm:block sm:text-base pb-3">
            {t("apps")}
          </div>
          <div className="flex flex-col sm:space-y-3">
            <Link
              href="/apps/collection/trending"
              className="flex h-12 items-center justify-center text-center text-xl text-inherit hover:underline sm:block sm:h-auto sm:text-start sm:text-sm"
            >
              {t("trending")}
            </Link>
            <Link
              href="/apps/collection/popular"
              className="flex h-12 items-center justify-center text-center text-xl text-inherit hover:underline sm:block sm:h-auto sm:text-start sm:text-sm"
            >
              {t("popular")}
            </Link>
            <Link
              href="/apps/collection/recently-added"
              className="flex h-12 items-center justify-center text-center text-xl text-inherit hover:underline sm:block sm:h-auto sm:text-start sm:text-sm"
            >
              {t("new")}
            </Link>
            <Link
              href="/apps/collection/recently-updated"
              className="flex h-12 items-center justify-center text-center text-xl text-inherit hover:underline sm:block sm:h-auto sm:text-start sm:text-sm"
            >
              {t("updated")}
            </Link>
            <Link
              href="/apps/collection/verified"
              className="flex h-12 items-center justify-center text-center text-xl text-inherit hover:underline sm:block sm:h-auto sm:text-start sm:text-sm"
            >
              {t("verified")}
            </Link>
            <Link
              href="/feeds"
              className="flex h-12 items-center justify-center text-center text-xl text-inherit hover:underline sm:block sm:h-auto sm:text-start sm:text-sm"
            >
              {t("rss-feeds")}
            </Link>
          </div>
        </div>

        <div>
          <div className="flex justify-center text-2xl font-bold sm:block sm:text-base pb-3">
            {t("community")}
          </div>
          <div className="flex flex-col sm:space-y-3">
            <a
              className="flex h-12 items-center justify-center text-center text-xl text-inherit hover:underline sm:block sm:h-auto sm:text-start sm:text-sm"
              href="https://discourse.flathub.org/"
              target="_blank"
              rel="noreferrer"
            >
              {t("forum")}
            </a>
            <a
              className="flex h-12 items-center justify-center text-center text-xl text-inherit hover:underline sm:block sm:h-auto sm:text-start sm:text-sm"
              href="https://matrix.to/#/#flathub:matrix.org"
              target="_blank"
              rel="noreferrer"
            >
              {t("chat")}
            </a>
            <a
              className="flex h-12 items-center justify-center text-center text-xl text-inherit hover:underline sm:block sm:h-auto sm:text-start sm:text-sm"
              href="https://floss.social/@flathub"
              target="_blank"
              rel="noreferrer me"
            >
              {t("mastodon")}
            </a>
          </div>
        </div>

        <div>
          <div className="flex justify-center text-2xl font-bold sm:block sm:text-base pb-3">
            {t("developers")}
          </div>
          <div className="flex flex-col sm:space-y-3">
            <Link
              href="/developer-portal"
              className="flex h-12 items-center justify-center text-center text-xl text-inherit hover:underline sm:block sm:h-auto sm:text-start sm:text-sm"
            >
              {t("developer-portal")}
            </Link>
            <a
              className="flex h-12 items-center justify-center text-center text-xl text-inherit hover:underline sm:block sm:h-auto sm:text-start sm:text-sm"
              href="https://docs.flathub.org/docs/for-app-authors/submission"
              target="_blank"
              rel="noreferrer"
            >
              {t("publish-your-app")}
            </a>
            <a
              className="flex h-12 items-center justify-center text-center text-xl text-inherit hover:underline sm:block sm:h-auto sm:text-start sm:text-sm"
              href="https://docs.flathub.org/"
              target="_blank"
              rel="noreferrer"
            >
              {t("documentation")}
            </a>
            <Link
              href="/badges"
              className="flex h-12 items-center justify-center text-center text-xl text-inherit hover:underline sm:block sm:h-auto sm:text-start sm:text-sm"
            >
              {t("badges")}
            </Link>
          </div>
        </div>

        <div>
          <div className="flex justify-center text-2xl font-bold sm:block sm:text-base pb-3">
            {t("flathub")}
          </div>
          <div className="flex flex-col sm:space-y-3">
            <Link
              href="/setup"
              className="flex h-12 items-center justify-center text-center text-xl text-inherit hover:underline sm:block sm:h-auto sm:text-start sm:text-sm"
            >
              {t("setup")}
            </Link>
            <Link
              href="/languages"
              className="flex h-12 items-center justify-center text-center text-xl text-inherit hover:underline sm:block sm:h-auto sm:text-start sm:text-sm"
            >
              {t("switch-language")}
            </Link>
            <Link
              href="/terms-and-conditions"
              className="flex h-12 items-center justify-center text-center text-xl text-inherit hover:underline sm:block sm:h-auto sm:text-start sm:text-sm"
            >
              {t("terms-and-conditions")}
            </Link>
            <Link
              href="/privacy-policy"
              className="flex h-12 items-center justify-center text-center text-xl text-inherit hover:underline sm:block sm:h-auto sm:text-start sm:text-sm"
            >
              {t("privacy-policy")}
            </Link>
            <Link
              href="/statistics"
              className="flex h-12 items-center justify-center text-center text-xl text-inherit hover:underline sm:block sm:h-auto sm:text-start sm:text-sm"
            >
              {t("statistics")}
            </Link>
            <Link
              href="/about"
              className="flex h-12 items-center justify-center text-center text-xl text-inherit hover:underline sm:block sm:h-auto sm:text-start sm:text-sm"
            >
              {t("about")}
            </Link>
            <Link
              href="/consultants"
              className="flex h-12 items-center justify-center text-xl text-inherit hover:underline sm:block sm:h-auto sm:text-sm"
            >
              {t("consultants")}
            </Link>
            <a
              className="flex h-12 items-center justify-center text-center text-xl text-inherit hover:underline sm:block sm:h-auto sm:text-start sm:text-sm"
              href="https://status.flathub.org/"
              target="_blank"
              rel="noreferrer"
            >
              {t("status")}
            </a>
            <a
              className="flex h-12 items-center justify-center text-center text-xl text-inherit hover:underline sm:block sm:h-auto sm:text-start sm:text-sm"
              href="https://github.com/flathub-infra/website"
              target="_blank"
              rel="noreferrer"
            >
              {t("source-code")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
