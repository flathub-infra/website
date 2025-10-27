import clsx from "clsx"
import { useTranslations } from "next-intl"
import { FunctionComponent, createElement, useState } from "react"
import {
  AppSafetyRating,
  safetyRatingToColor,
  safetyRatingToIcon,
  safetyRatingToTranslationKey,
} from "src/safety"
import { StackedListBox } from "./StackedListBox"
import Modal from "../Modal"

interface Props {
  appName: string

  safetyRating: AppSafetyRating[]
}

const SafetyRatingIcon = ({
  highestSafetyRating,
  size,
  icon,
}: {
  highestSafetyRating: number
  size: "small" | "large"
  icon?: React.ElementType
}) => {
  return (
    <div
      className={clsx(
        size === "small" ? "h-10 w-10" : "h-16 w-16",
        "rounded-full p-2",
        safetyRatingToColor(highestSafetyRating),
      )}
    >
      {icon
        ? createElement(icon, {
            className: "w-full h-full",
            "aria-hidden": true,
          })
        : safetyRatingToIcon(highestSafetyRating)}
    </div>
  )
}

const SafetyRating: FunctionComponent<Props> = ({ appName, safetyRating }) => {
  const t = useTranslations()
  const [isOpen, setIsOpen] = useState(false)

  const highestSafetyRating = Math.max(
    ...Object.values(safetyRating).map((x) => x.safetyRating),
  )

  return (
    <>
      <button
        className={clsx(
          "flex w-full flex-col items-center gap-1 p-4 duration-500 hover:bg-flathub-gainsborow/20 justify-center",
          "active:bg-flathub-gainsborow/40 active:shadow-xs dark:hover:bg-flathub-dark-gunmetal/20 dark:active:bg-flathub-arsenic",
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
            .filter(
              (x) =>
                x.showOnSummaryOrDetails === "summary" ||
                x.showOnSummaryOrDetails === "both",
            )
            .map((x) => t(x.title, x.titleOptions))
            .join("; ")}
        </div>
      </button>

      <Modal
        shown={isOpen}
        centerTitle
        onClose={() => setIsOpen(false)}
        aboveTitle={
          <div className="flex flex-col items-center pb-2">
            <SafetyRatingIcon
              highestSafetyRating={highestSafetyRating}
              size="large"
            />
          </div>
        }
        title={t(`appname-is-safety-rating-${highestSafetyRating}`, {
          appName: appName,
        })}
      >
        <>
          <div className="w-full">
            <StackedListBox
              items={safetyRating
                .filter(
                  (x) =>
                    x.showOnSummaryOrDetails === "details" ||
                    x.showOnSummaryOrDetails === "both",
                )
                .sort((a, b) => b.safetyRating - a.safetyRating)
                .map(
                  (
                    {
                      title,
                      titleOptions,
                      description,
                      descriptionOptions,
                      safetyRating,
                      icon,
                    },
                    i,
                  ) => ({
                    id: i,
                    header: t(title, titleOptions),
                    description: t(description, descriptionOptions),
                    icon: (
                      <SafetyRatingIcon
                        highestSafetyRating={safetyRating}
                        size="small"
                        icon={icon}
                      />
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

export default SafetyRating
