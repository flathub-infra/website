import clsx from "clsx"
import { useLocale, useTranslations } from "next-intl"
import { FunctionComponent, useState } from "react"
import {
  getContentRating,
  contentRatingToColor,
  contentRatingToIcon,
} from "src/contentRating"
import { ContentRatingAttribute, ContentRatingLevel } from "src/types/Appstream"
import { Summary } from "src/types/Summary"
import { StackedListBox } from "./StackedListBox"
import Modal from "../Modal"
import { GetAppstreamAppstreamAppIdGet200 } from "src/codegen"

interface Props {
  data: GetAppstreamAppstreamAppIdGet200
  summary: Summary
}

const ContentRatingIcon = ({
  attr,
  level,
}: {
  attr: ContentRatingAttribute
  level: ContentRatingLevel
}) => {
  return (
    <div
      className={clsx(
        "h-12 w-12",
        "rounded-full p-2",
        contentRatingToColor(level),
      )}
    >
      {contentRatingToIcon(attr)}
    </div>
  )
}

const ContentRating: FunctionComponent<Props> = ({ data }) => {
  const t = useTranslations()
  const locale = useLocale()
  const [isOpen, setIsOpen] = useState(false)

  const contentRating = getContentRating(data, locale)

  if (!contentRating) {
    return null
  }

  return (
    <>
      <button
        className={clsx(
          "flex w-full flex-col items-center gap-1 p-4 duration-500 hover:bg-flathub-gainsborow/20 justify-center",
          "active:bg-flathub-gainsborow/40 active:shadow-sm hover:dark:bg-flathub-dark-gunmetal/20 active:dark:bg-flathub-arsenic",
          "text-flathub-arsenic dark:text-flathub-gainsborow",
        )}
        onClick={() => setIsOpen(true)}
      >
        <div className="text-lg font-bold">
          {contentRating.minimumAge === 0
            ? t("all-ages")
            : t("ages-x-plus", { age: contentRating.minimumAge })}
        </div>
        <div className="text-xs text-flathub-arsenic/60 dark:text-flathub-gainsborow/60">
          {t("content-rating")}
        </div>
      </button>

      <Modal
        shown={isOpen}
        centerTitle
        onClose={() => setIsOpen(false)}
        title={t("content-rating")}
      >
        <div className="w-full">
          <StackedListBox
            items={contentRating.attrs.map(
              ({ attr, level, description }, i) => ({
                id: i,
                header: t(`content-rating-${description}`),
                description: t(`content-rating-${level}`),
                icon: <ContentRatingIcon attr={attr} level={level} />,
              }),
            )}
          />
        </div>
      </Modal>
    </>
  )
}

export default ContentRating
