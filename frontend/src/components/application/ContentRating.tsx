import clsx from "clsx"
import { useTranslation } from "next-i18next"
import { FunctionComponent, createElement, useState } from "react"
import {
  getContentRating,
  contentRatingToColor,
  contentRatingToIcon,
} from "src/contentRating"
import {
  Appstream,
  ContentRatingAttribute,
  ContentRatingLevel,
} from "src/types/Appstream"
import { StackedListBox } from "./StackedListBox"
import Modal from "../Modal"

interface Props {
  data: Appstream
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
        size === "small" ? "h-10 w-10" : "h-16 w-16",
        "rounded-full p-2",
        contentRatingToColor(level),
      )}
    >
      {icon
        ? createElement(icon, {
            className: "w-full h-full",
          })
        : contentRatingToIcon(attr)}
    </div>
  )
}

const ContentRating: FunctionComponent<Props> = ({ data }) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  const contentRating = getContentRating(data)

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
          {contentRating.minimumAge}
        </div>
      </button>

      <Modal
        shown={isOpen}
        centerTitle
        onClose={() => setIsOpen(false)}
        aboveTitle={
          <div className="flex flex-col items-center pb-2">
            {minimumAgeFormatted}
          </div>
        }
      >
        <>
          <div className="w-full">
            <StackedListBox
              items={contentRating.attrs
                .map(
                  (
                    {
                      attr,
                      level,
                      description,
                    },
                    i,
                  ) => ({
                    id: i,
                    header: description,
                    icon: (
                      <ContentRatingIcon attr={attr} level={level} />
                    ),
                  }),
                )}
            />
          </div>
        </>
      </Modal>
    </>
  )
}

export default ContentRating
