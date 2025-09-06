"use client"

import { useTranslations } from "next-intl"
import {
  getLanguageFlag,
  getLanguageName,
  languages,
} from "../../../src/localize"
import type { JSX } from "react"
import { Link } from "src/i18n/navigation"

const LanguagesClient = (): JSX.Element => {
  const t = useTranslations()

  return (
    <div className="max-w-11/12 sm:w-max-1/2 mx-auto my-0 mt-12 w-11/12 sm:w-1/2 2xl:w-[900px] 2xl:max-w-[900px]">
      <h1 className="mb-8 text-4xl font-extrabold">{t("languages")}</h1>
      <p>{t("languages-description")}</p>
      <ul className="columns-1 space-y-2 text-lg sm:columns-2 sm:gap-0 sm:space-y-0 sm:text-base 2xl:columns-3">
        {languages
          .sort((a, b) => getLanguageName(a).localeCompare(getLanguageName(b)))
          .map((language) => (
            <li key={language}>
              <Link
                className="no-underline hover:underline"
                href={`/`}
                locale={language}
              >
                {getLanguageFlag(language) + " " + getLanguageName(language)}
              </Link>
            </li>
          ))}
      </ul>
      <p className="pt-8">
        {t.rich("contribute-languages", {
          link: (chunks) => (
            <a
              target="_blank"
              rel="noreferrer"
              className="no-underline hover:underline"
              href="https://hosted.weblate.org/engage/flathub/"
            >
              {chunks}
            </a>
          ),
        })}
      </p>
    </div>
  )
}

export default LanguagesClient
