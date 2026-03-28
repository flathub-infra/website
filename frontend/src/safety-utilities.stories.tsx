import type { Meta } from "@storybook/nextjs-vite"
import {
  safetyRatingToColor,
  safetyRatingToIcon,
  safetyRatingToTranslationKey,
} from "./safety"
import { useTranslations } from "next-intl"

const SafetyRatingColorDemo = ({ rating }: { rating: number }) => {
  const t = useTranslations()
  return (
    <div
      className={`px-4 py-2 rounded-full text-sm font-medium ${safetyRatingToColor(rating)}`}
    >
      {t(safetyRatingToTranslationKey(rating))} (Rating {rating})
    </div>
  )
}

const SafetyRatingIconDemo = ({ rating }: { rating: number }) => {
  const t = useTranslations()
  return (
    <div className="flex items-center gap-3">
      <div className={`p-3 rounded-full ${safetyRatingToColor(rating)}`}>
        <div className="w-6 h-6">{safetyRatingToIcon(rating)}</div>
      </div>
      <span className="text-lg font-medium">
        {t(safetyRatingToTranslationKey(rating))}
      </span>
    </div>
  )
}

const meta = {
  title: "Components/Safety/Utilities",
  parameters: {
    layout: "centered",
  },
} satisfies Meta

export default meta

export const SafetyRatingColors = {
  render: () => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Safety Rating Colors</h2>
      <div className="space-y-2">
        <SafetyRatingColorDemo rating={1} />
        <SafetyRatingColorDemo rating={2} />
        <SafetyRatingColorDemo rating={3} />
        <SafetyRatingColorDemo rating={4} />
      </div>
    </div>
  ),
}

export const SafetyRatingIcons = {
  render: () => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Safety Rating Icons</h2>
      <div className="space-y-3">
        <SafetyRatingIconDemo rating={1} />
        <SafetyRatingIconDemo rating={2} />
        <SafetyRatingIconDemo rating={3} />
        <SafetyRatingIconDemo rating={4} />
      </div>
    </div>
  ),
}
