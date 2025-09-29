import { useTranslations } from "next-intl"
import { FunctionComponent } from "react"
import Badge from "./Tag"
import { Link } from "src/i18n/navigation"

interface Props {
  keywords: string[]
}

const Tags: FunctionComponent<Props> = ({ keywords }) => {
  const t = useTranslations()

  if (!keywords) return null

  // Remove duplicates
  const keywordSet = new Set(keywords.map((keyword) => keyword.toLowerCase()))

  return (
    <>
      {keywordSet.size > 0 && (
        <div className="flex gap-2 text-sm">
          <div>{t("tags-colon")}</div>
          <div className="flex flex-wrap gap-2 lowercase">
            {Array.from(keywordSet).map((item, index) => {
              const synteticTag = item === "linux" || item === "flatpak"

              return (
                <Link
                  key={index}
                  href={
                    synteticTag
                      ? `/apps/search?q=${item}`
                      : `/apps/collection/tag/${item}`
                  }
                >
                  <Badge text={item} />
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
