import clsx from "clsx"
import { useTranslations } from "next-intl"
import {
  categoryToIcon,
  contentRatingToColor,
  ageToColor,
} from "src/contentRating"
import type { OarsCategory, ContentRatingDisplay } from "src/contentRating"
import { ContentRatingLevel } from "src/types/Appstream"
import Modal from "../../Modal"
import { StackedListBox } from "../StackedListBox"

const ContentRatingCategoryIcon = ({
  category,
  level,
}: {
  category: OarsCategory
  level: ContentRatingLevel
}) => (
  <div
    className={clsx(
      "size-10 rounded-full p-2 flex-shrink-0",
      contentRatingToColor(level),
    )}
  >
    {categoryToIcon(category)}
  </div>
)

const AgeBadge = ({ age, colorClass }: { age: string; colorClass: string }) => (
  <div className="flex justify-center pb-2">
    <div
      className={clsx(
        "size-16 rounded-full flex items-center justify-center text-xl font-bold",
        colorClass,
      )}
    >
      {age}
    </div>
  </div>
)

const ContentRatingModal = ({
  isOpen,
  onClose,
  contentRating,
  appName,
}: {
  isOpen: boolean
  onClose: () => void
  contentRating: ContentRatingDisplay
  appName: string
}) => {
  const t = useTranslations()

  const ageLabel =
    contentRating.minimumAge === null
      ? "3+"
      : `${Math.max(contentRating.minimumAge, 3)}+`

  const ageBadgeColor = ageToColor(contentRating.minimumAge)

  return (
    <Modal
      shown={isOpen}
      onClose={onClose}
      centerTitle
      title={t("content-rating.subtitle", { appName, age: ageLabel })}
      aboveTitle={<AgeBadge age={ageLabel} colorClass={ageBadgeColor} />}
      size="sm"
    >
      {contentRating.categories.length > 0 ? (
        <StackedListBox
          items={contentRating.categories.map(
            ({ id, level, description }, i) => ({
              id: i,
              header: t(`content-rating.category-${id}`),
              description:
                description ??
                (level === ContentRatingLevel.unknown
                  ? t("content-rating.unknown")
                  : undefined),
              icon: <ContentRatingCategoryIcon category={id} level={level} />,
            }),
          )}
        />
      ) : (
        <p className="text-sm text-center text-flathub-sonic-silver dark:text-flathub-spanish-gray py-2">
          {"3+"}
        </p>
      )}
    </Modal>
  )
}

export default ContentRatingModal
