import { useTranslations } from "next-intl"
import { AppSafetyRating } from "../../../safety"
import Modal from "../../Modal"
import { StackedListBox } from "../StackedListBox"
import { SafetyIcon } from "./SafetyIcons"

const SafetyModal = ({
  isOpen,
  onClose,
  appName,
  safetyRating,
}: {
  isOpen: boolean
  onClose: () => void
  appName: string
  safetyRating: AppSafetyRating[]
}) => {
  const t = useTranslations()
  const highestSafetyRating = Math.max(
    ...safetyRating.map((x) => x.safetyRating),
  )

  return (
    <Modal
      shown={isOpen}
      onClose={onClose}
      centerTitle
      aboveTitle={
        <div className="flex flex-col items-center pb-2">
          <SafetyIcon safetyRating={highestSafetyRating} size="size-16" />
        </div>
      }
      title={t(`appname-is-safety-rating-${highestSafetyRating}`, {
        appName,
      })}
      size="sm"
    >
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
                safetyRating: rating,
                icon,
              },
              i,
            ) => ({
              id: i,
              header: t(title, titleOptions),
              description: t(description, descriptionOptions),
              icon: (
                <SafetyIcon size="size-10" safetyRating={rating} icon={icon} />
              ),
            }),
          )}
      />
    </Modal>
  )
}

export default SafetyModal
