import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import Badge from "./Badge"
import Link from "next/link"

interface Props {
  keywords: string[]
}

const Tags: FunctionComponent<Props> = ({ keywords }) => {
  const { t } = useTranslation()

  if (!keywords) return null

  // Remove duplicates
  const keywordSet = new Set(keywords.map((keyword) => keyword.toLowerCase()))

  return (
    <>
      {keywordSet.size && (
        <div className="flex gap-2 text-sm">
          <div>{t("tags-colon")}</div>
          <div className="flex flex-wrap gap-2 lowercase">
            {keywordSet.size &&
              Array.from(keywordSet).map((item, index) => {
                return (
                  <Link key={index} href={`/apps/search/${item}`}>
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
