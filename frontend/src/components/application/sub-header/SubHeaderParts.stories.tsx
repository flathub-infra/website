import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { SafetyIcon } from "./SafetyIcons"
import LicenseIconCircle from "./LicenseIconCircle"
import SizeBadge from "./SizeBadge"
import SubHeaderItem from "./SubHeaderItem"
import {
  HeartIcon,
  Users2Icon,
  ThumbsUpIcon,
  HandIcon,
  TriangleAlertIcon,
  EyeOffIcon,
} from "lucide-react"

const meta = {
  title: "Components/Application/SubHeader/Parts",
  parameters: {
    layout: "centered",
  },
} satisfies Meta

export default meta

export const SafetyIconsSafe = {
  render: () => (
    <div className="flex gap-2">
      <SafetyIcon safetyRating={1} />
      <SafetyIcon safetyRating={2} />
      <SafetyIcon safetyRating={3} />
      <SafetyIcon safetyRating={4} />
    </div>
  ),
}

export const SafetyIconsMedium = {
  render: () => (
    <div className="flex gap-2">
      <SafetyIcon safetyRating={1} size="size-10" />
      <SafetyIcon safetyRating={2} size="size-10" />
      <SafetyIcon safetyRating={3} size="size-10" />
      <SafetyIcon safetyRating={4} size="size-10" />
    </div>
  ),
}
export const SafetyIconsLarge = {
  render: () => (
    <div className="flex gap-2">
      <SafetyIcon safetyRating={1} size="size-16" />
      <SafetyIcon safetyRating={2} size="size-16" />
      <SafetyIcon safetyRating={3} size="size-16" />
      <SafetyIcon safetyRating={4} size="size-16" />
    </div>
  ),
}

export const LicenseIconsFLOSS = {
  render: () => (
    <div className="flex gap-1">
      <LicenseIconCircle color="green" icon={HeartIcon} />
      <LicenseIconCircle color="green" icon={Users2Icon} />
      <LicenseIconCircle color="green" icon={ThumbsUpIcon} />
    </div>
  ),
}

export const LicenseIconsProprietary = {
  render: () => (
    <div className="flex gap-1">
      <LicenseIconCircle color="yellow" icon={HandIcon} />
      <LicenseIconCircle color="yellow" icon={TriangleAlertIcon} />
      <LicenseIconCircle color="yellow" icon={EyeOffIcon} />
    </div>
  ),
}

export const SizeBadges = {
  render: () => (
    <div className="flex gap-2">
      <SizeBadge size="12.5 MB" />
      <SizeBadge size="1.2 GB" />
      <SizeBadge size="512 KB" />
    </div>
  ),
}

export const SubHeaderItemExample = {
  render: () => (
    <div className="flex gap-2">
      <SubHeaderItem onClick={() => {}}>
        <span className="inline-flex items-center rounded-full bg-flathub-gainsborow/60 px-3 py-1 text-sm font-bold leading-none tabular-nums dark:bg-flathub-granite-gray/60">
          193.36 MiB
        </span>
        <span className="text-xs text-flathub-sonic-silver dark:text-flathub-spanish-gray/80">
          Download
        </span>
      </SubHeaderItem>
    </div>
  ),
}
