import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import Badge from "./Badge"
import Link from "next/link"

interface Props {
  keywords: string[]
}

const Tags: FunctionComponent<Props> = ({ keywords }) => {
  const { t } = useTranslation()

  return (
    <>
      {keywords && (
        <div className="flex gap-2 text-sm">
          <div>{t("tags-colon")}</div>
          <div className="flex flex-wrap gap-2">
            {keywords &&
              keywords.map((item, index) => {
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
