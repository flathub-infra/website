import clsx from "clsx"
import { useTranslations } from "next-intl"
import {
  categoryToIcon,
  contentRatingToColor,
  groupContentRatingByCategory,
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

const ContentRatingModal = ({
  isOpen,
  onClose,
  contentRating,
}: {
  isOpen: boolean
  onClose: () => void
  contentRating: ContentRatingDisplay
}) => {
  const t = useTranslations()

  const title =
    contentRating.minimumAge === null
      ? "3+"
      : `${Math.max(contentRating.minimumAge, 3)}+`

  const categories = groupContentRatingByCategory(contentRating.attrs)

  return (
    <Modal
      shown={isOpen}
      onClose={onClose}
      centerTitle
      title={title}
      size="sm"
    >
      {categories.length > 0 ? (
        <StackedListBox
          items={categories.map(({ category, level, descriptions, isEmpty }, i) => ({
            id: i,
            header: t(`content-rating-category-${category}`),
            description: isEmpty
              ? t(`content-rating-category-none-${category}`)
              : descriptions.join(" • "),
            icon: (
              <ContentRatingCategoryIcon category={category} level={level} />
            ),
          }))}
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
