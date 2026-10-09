import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import SubHeader from "./SubHeader"
import { expect, userEvent, within } from "storybook/test"
import {
  CircleCheckIcon,
  ShieldCheckIcon,
  WifiIcon,
  VideoIcon,
  TriangleAlertIcon,
  CircleQuestionMarkIcon,
} from "lucide-react"

const meta = {
  component: SubHeader,
  title: "Components/Application/SubHeader",
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="grid grid-cols-[1fr] max-w-4xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SubHeader>

export default meta

type Story = StoryObj<typeof meta>

const baseApp = {
  id: "org.example.App",
  name: "Example App",
  summary: "An example application",
  project_license: "GPL-3.0+",
  is_free_license: true,
  isMobileFriendly: false,
} as any

const baseSummary = {
  download_size: 203456789,
  installed_size: 512000000,
  arches: ["x86_64", "aarch64"],
  metadata: {
    runtime: "org.freedesktop.Platform/x86_64/23.08",
    runtimeInstalledSize: 1024000000,
    runtimeName: "Freedesktop Platform 23.08",
    permissions: {
      shared: ["network"],
      sockets: [],
      devices: [],
      filesystems: [],
      "session-bus": { talk: [], own: [] },
    },
    runtimeIsEol: false,
  },
  timestamp: Math.floor(Date.now() / 1000),
} as any

const baseStats = {
  installs_total: 150000,
  installs_last_month: 12500,
  installs_last_7_days: 3200,
  installs_per_day: {},
  installs_per_country: {},
} as any

const safeSafetyRating = [
  {
    safetyRating: 1,
    title: "no-user-device-access",
    description: "no-user-device-access-description",
    icon: ShieldCheckIcon,
    showOnSummaryOrDetails: "both" as const,
  },
  {
    safetyRating: 1,
    title: "no-network-access",
    description: "no-network-access-description",
    icon: CircleCheckIcon,
    showOnSummaryOrDetails: "both" as const,
  },
  {
    safetyRating: 1,
    title: "auditable-code",
    description: "auditable-code-description",
    icon: CircleCheckIcon,
    showOnSummaryOrDetails: "both" as const,
  },
]

const unsafeSafetyRating = [
  {
    safetyRating: 3,
    title: "user-device-access",
    description: "can-access-hardware-devices",
    icon: VideoIcon,
    showOnSummaryOrDetails: "both" as const,
  },
  {
    safetyRating: 3,
    title: "has-network-access",
    description: "has-network-access-description",
    icon: WifiIcon,
    showOnSummaryOrDetails: "both" as const,
  },
  {
    safetyRating: 3,
    title: "proprietary-code",
    description: "proprietary-code-description",
    icon: TriangleAlertIcon,
    showOnSummaryOrDetails: "both" as const,
  },
]

export const SafeFLOSSApp: Story = {
  args: {
    app: baseApp,
    summary: baseSummary,
    stats: baseStats,
    safetyRating: safeSafetyRating,
  },
}

export const ProprietaryApp: Story = {
  args: {
    app: {
      ...baseApp,
      project_license: "LicenseRef-proprietary",
      is_free_license: false,
    },
    summary: baseSummary,
    stats: baseStats,
    safetyRating: unsafeSafetyRating,
  },
}

export const MobileFriendly: Story = {
  args: {
    app: {
      ...baseApp,
      isMobileFriendly: true,
    },
    summary: baseSummary,
    stats: baseStats,
    safetyRating: safeSafetyRating,
  },
}

export const DeviceSupport: Story = {
  args: {
    app: {
      ...baseApp,
      requires: [{ type: "memory", value: "6GB", compare: "ge" }],
      recommends: [{ type: "control", value: "gamepad" }],
      supports: [
        { type: "control", value: "keyboard" },
        { type: "control", value: "pointing" },
        { type: "control", value: "touch" },
        { type: "display_length", value: "360", compare: "ge" },
      ],
    },
    summary: baseSummary,
    stats: baseStats,
    safetyRating: safeSafetyRating,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText("Adaptive"))

    const page = within(canvasElement.ownerDocument.body)
    expect(page.getAllByText("Adaptive")).toHaveLength(2)
    expect(
      page.getByText("Works on phones, tablets and desktops"),
    ).toBeInTheDocument()
    expect(page.getByText("Works well on mobile devices")).toBeInTheDocument()
    expect(page.getByText("Works well on large screens")).toBeInTheDocument()
    expect(page.getByText("Keyboard support")).toBeInTheDocument()
    expect(page.getByText("Supports keyboards")).toBeInTheDocument()
    expect(page.getByText("Recommends gamepads")).toBeInTheDocument()
  },
}

export const UnknownControlsAreHidden: Story = {
  args: {
    app: baseApp,
    summary: baseSummary,
    stats: baseStats,
    safetyRating: safeSafetyRating,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText("Hardware support"))

    const page = within(canvasElement.ownerDocument.body)
    expect(page.queryByText("Gamepad support")).not.toBeInTheDocument()
    expect(
      page.queryByText("Unknown support for gamepads"),
    ).not.toBeInTheDocument()
    expect(page.getByText("Unknown support for keyboards")).toBeInTheDocument()
    expect(page.queryByText("Memory requirement")).not.toBeInTheDocument()
  },
}

export const NoStats: Story = {
  args: {
    app: baseApp,
    summary: baseSummary,
    stats: null,
    safetyRating: safeSafetyRating,
  },
}

export const NoSummary: Story = {
  args: {
    app: baseApp,
    summary: null,
    stats: null,
    safetyRating: [],
  },
}
