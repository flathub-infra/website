import Link from "next/link"
import { useTranslation } from "next-i18next"

const Footer = () => {
  const { t } = useTranslation()

  return (
    <footer className="mt-16 bg-colorPrimary p-12">
      <div className="mx-auto grid max-w-[900px] grid-cols-1 justify-items-center gap-0 sm:grid-cols-2 md:grid-cols-4">
        <div className="m-3 min-w-[200px] text-gray-100 ">
          <div className="flex justify-center text-2xl font-bold sm:block sm:text-base">
            {t("applications")}
          </div>
          <div className="flex flex-col">
            <Link href="/apps/collection/popular">
              <a className="flex h-12 items-center justify-center text-xl text-inherit sm:block sm:h-auto sm:text-sm">
                {t("popular")}
              </a>
            </Link>
            <Link href="/apps/collection/recently-added">
              <a className="flex h-12 items-center justify-center text-xl text-inherit sm:block sm:h-auto sm:text-sm">
                {t("recently-added-apps")}
              </a>
            </Link>
            <Link href="/apps/collection/recently-updated">
              <a className="flex h-12 items-center justify-center text-xl text-inherit sm:block sm:h-auto sm:text-sm">
                {t("new-and-updated")}
              </a>
            </Link>
            <Link href="/apps">
              <a className="flex h-12 items-center justify-center text-xl text-inherit sm:block sm:h-auto sm:text-sm">
                {t("browse-apps")}
              </a>
            </Link>
            <Link href="/feeds">
              <a className="flex h-12 items-center justify-center text-xl text-inherit sm:block sm:h-auto sm:text-sm">
                {t("rss-feeds")}
              </a>
            </Link>
          </div>
        </div>

        <div className="m-3 min-w-[200px] text-gray-100 ">
          <div className="flex justify-center text-2xl font-bold sm:block sm:text-base">
            {t("community")}
          </div>
          <div className="flex flex-col">
            <a
              className="flex h-12 items-center justify-center text-xl text-inherit sm:block sm:h-auto sm:text-sm"
              href="https://flatpak.org/about/"
              target="_blank"
              rel="noreferrer"
            >
              {t("get-involved")}
            </a>
            <a
              className="flex h-12 items-center justify-center text-xl text-inherit sm:block sm:h-auto sm:text-sm"
              href="https://discourse.flathub.org/"
              target="_blank"
              rel="noreferrer"
            >
              {t("forum")}
            </a>
            <a
              className="flex h-12 items-center justify-center text-xl text-inherit sm:block sm:h-auto sm:text-sm"
              href="https://twitter.com/FlatpakApps"
              target="_blank"
              rel="noreferrer"
            >
              {t("follow-us")}
            </a>
          </div>
        </div>

        <div className="m-3 min-w-[200px] text-gray-100 ">
          <div className="flex justify-center text-2xl font-bold sm:block sm:text-base">
            {t("developers")}
          </div>
          <div className="flex flex-col">
            <a
              className="flex h-12 items-center justify-center text-xl text-inherit sm:block sm:h-auto sm:text-sm"
              href="https://github.com/flathub/flathub/wiki/App-Submission"
              target="_blank"
              rel="noreferrer"
            >
              {t("publish-your-app")}
            </a>
            <a
              className="flex h-12 items-center justify-center text-xl text-inherit sm:block sm:h-auto sm:text-sm"
              href="http://docs.flatpak.org/"
              target="_blank"
              rel="noreferrer"
            >
              {t("documentation")}
            </a>
            <Link href="/badges">
              <a className="flex h-12 items-center justify-center text-xl text-inherit sm:block sm:h-auto sm:text-sm">
                {t("badges")}
              </a>
            </Link>
          </div>
        </div>

        <div className="m-3 min-w-[200px] text-gray-100 ">
          <div className="flex justify-center text-2xl font-bold sm:block sm:text-base">
            Flathub
          </div>
          <div className="flex flex-col">
            <Link href="/languages">
              <a className="flex h-12 items-center justify-center text-xl text-inherit sm:block sm:h-auto sm:text-sm">
                {t("switch-language")}
              </a>
            </Link>
            <Link href="/terms-and-conditions">
              <a className="flex h-12 items-center justify-center text-xl text-inherit sm:block sm:h-auto sm:text-sm">
                {t("terms-and-conditions")}
              </a>
            </Link>
            <Link href="/privacy-policy">
              <a className="flex h-12 items-center justify-center text-xl text-inherit sm:block sm:h-auto sm:text-sm">
                {t("privacy-policy")}
              </a>
            </Link>
            <Link href="/statistics">
              <a className="flex h-12 items-center justify-center text-xl text-inherit sm:block sm:h-auto sm:text-sm">
                {t("statistics")}
              </a>
            </Link>
            <Link href="/about">
              <a className="flex h-12 items-center justify-center text-xl text-inherit sm:block sm:h-auto sm:text-sm">
                {t("about")}
              </a>
            </Link>
            <a
              className="flex h-12 items-center justify-center text-xl text-inherit sm:block sm:h-auto sm:text-sm"
              href="https://status.flathub.org/"
              target="_blank"
              rel="noreferrer"
            >
              {t("status")}
            </a>
            <a
              className="flex h-12 items-center justify-center text-xl text-inherit sm:block sm:h-auto sm:text-sm"
              href="https://github.com/flathub/website"
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
