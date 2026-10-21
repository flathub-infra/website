import { useTranslations } from "next-intl"
import { FunctionComponent } from "react"
import { Link } from "src/i18n/navigation"

interface Props {
  keywords: string[]
}

const Tags: FunctionComponent<Props> = ({ keywords }) => {
  const t = useTranslations()

  if (!keywords) {
    return null
  }

  // Remove duplicates
  const keywordSet = new Set(keywords.map((keyword) => keyword.toLowerCase()))

  return (
    <>
      {keywordSet.size > 0 && (
        <div className="flex min-w-0 flex-col gap-2 text-sm sm:flex-row sm:items-baseline">
          <div className="shrink-0 font-medium text-flathub-granite-gray dark:text-flathub-spanish-gray">
            {t("tags-colon")}
          </div>
          <div className="flex min-w-0 flex-wrap gap-2 lowercase">
            {Array.from(keywordSet).map((item, index) => {
              const synteticTag = item === "linux" || item === "flatpak"

              return (
                <Link
                  key={index}
                  className="inline-flex min-h-11 min-w-0 max-w-full items-center rounded-full bg-flathub-gainsborow/70 px-3 py-2 text-flathub-dark-gunmetal no-underline transition-colors hover:bg-flathub-gainsborow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flathub-celestial-blue dark:bg-flathub-granite-gray/70 dark:text-flathub-lotion dark:hover:bg-flathub-granite-gray"
                  href={
                    synteticTag
                      ? `/apps/search?q=${item}`
                      : `/apps/collection/tag/${item}`
                  }
                >
                  <span className="[overflow-wrap:anywhere]">{item}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

export default Tags
