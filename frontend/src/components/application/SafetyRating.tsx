import clsx from "clsx"
import { useTranslation } from "next-i18next"
import { FunctionComponent, createElement, useState } from "react"
import {
  getSafetyRating,
  safetyRatingToColor,
  safetyRatingToIcon,
  safetyRatingToTranslationKey,
} from "src/safety"
import { Appstream } from "src/types/Appstream"
import { Summary } from "src/types/Summary"
import { StackedListBox } from "./StackedListBox"
import { IconType } from "react-icons"
import Modal from "../Modal"

interface Props {
  data: Appstream
  summary: Summary
}

const SafetyRatingIcon = ({
  highestSafetyRating,
  size,
  icon,
}: {
  highestSafetyRating: number
  size: "small" | "large"
  icon?: IconType
}) => {
  return (
    <div
      className={clsx(
        size === "small" ? "h-10 w-10" : "h-14 w-14",
        "rounded-full p-2",
        safetyRatingToColor(highestSafetyRating),
      )}
    >
      {icon
        ? createElement(icon, {
            className: "w-full h-full",
          })
        : safetyRatingToIcon(highestSafetyRating)}
    </div>
  )
}

const SafetyRating: FunctionComponent<Props> = ({ data, summary }) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  const safetyRating = getSafetyRating(data, summary)

  const highestSafetyRating = Math.max(
    ...Object.values(safetyRating).map((x) => x.safetyRating),
  )

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
        <SafetyRatingIcon
          highestSafetyRating={highestSafetyRating}
          size="small"
        />
        <div className="text-lg font-bold">
          {t(safetyRatingToTranslationKey(highestSafetyRating))}
        </div>
        <div className="text-center">
          {safetyRating
            .filter((x) => x.safetyRating === highestSafetyRating)
            .filter((x) => x.showOnSummary)
            .map((x) => t(x.description))
            .join("; ")}
        </div>
      </button>

      <Modal
        shown={isOpen}
        centerTitle
        onClose={() => setIsOpen(false)}
        title={t(`appname-is-safety-rating-${highestSafetyRating}`, {
          appName: data.name,
        })}
      >
        <>
          <div className="flex flex-col items-center gap-2">
            <SafetyRatingIcon
              highestSafetyRating={highestSafetyRating}
              size="large"
            />
          </div>
          <div className="mt-2 w-full">
            <StackedListBox
              items={safetyRating
                .sort((a, b) => b.safetyRating - a.safetyRating)
                .map(({ description, safetyRating, icon }, i) => ({
                  id: i,
                  header: t(description),
                  icon: (
                    <SafetyRatingIcon
                      highestSafetyRating={safetyRating}
                      size="small"
                      icon={icon}
                    />
                  ),
                }))}
            />
          </div>
        </>
      </Modal>
    </>
  )
}

export default SafetyRating
