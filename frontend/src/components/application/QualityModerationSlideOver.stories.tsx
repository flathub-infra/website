import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import { useState, type ReactNode } from "react"
import { expect, within } from "storybook/test"
import { QualityModerationSlideOver } from "./QualityModerationSlideOver"
import type {
  DesktopAppstream,
  QualityModerationModeratorResponse,
} from "src/codegen/model"

const appId = "org.example.QualityDemo"
const app = {
  id: appId,
  name: "Quality Demo",
  summary: "An example application used to preview checklist attribution.",
  icon: "https://flathub.org/img/logo/flathub-logo.png",
  branding: [],
} as DesktopAppstream

const referenceDate = new Date("2026-10-05T12:00:00Z")
const hoursAgo = (hours: number) =>
  new Date(referenceDate.getTime() - hours * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)

const response: QualityModerationModeratorResponse = {
  guidelines: [
    {
      guideline_id: "general-no-trademark-violations",
      app_id: appId,
      guideline: {
        id: "general-no-trademark-violations",
        url: "https://example.org/guideline",
        needed_to_pass_since: "2024-01-01",
        category: "general",
        read_only: false,
      },
      needed_to_pass_since: "2024-01-01",
      passed: true,
      comment: null,
      updated_at: hoursAgo(2),
      updated_by: "Alex Moderator",
    },
    {
      guideline_id: "general-runtime-not-eol",
      app_id: appId,
      guideline: {
        id: "general-runtime-not-eol",
        url: "https://example.org/guideline",
        needed_to_pass_since: "2024-01-01",
        category: "general",
        read_only: false,
      },
      needed_to_pass_since: "2024-01-01",
      passed: true,
      comment: null,
      updated_at: hoursAgo(24),
      updated_by: null,
    },
  ],
  is_fullscreen_app: false,
  review_requested_at: null,
  metadata_changed_at: {},
}

const mockResponse = (data: QualityModerationModeratorResponse) => ({
  msw: {
    handlers: [
      http.get(`*/quality-moderation/${appId}/moderator`, () =>
        HttpResponse.json(data),
      ),
    ],
  },
})

const StoryQueryProvider = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: Infinity, retry: false } },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const meta = {
  title: "Components/Application/QualityModerationSlideOver",
  component: QualityModerationSlideOver,
  parameters: {
    nextjs: { appDirectory: true },
    mockingDate: referenceDate,
    ...mockResponse(response),
  },
  decorators: [
    (Story, context) => (
      <StoryQueryProvider key={context.id}>
        <Story />
      </StoryQueryProvider>
    ),
  ],
  args: {
    mode: "qualityModerator",
    app,
    isQualityModalOpen: true,
    setIsQualityModalOpen: () => {},
  },
} satisfies Meta<typeof QualityModerationSlideOver>

export default meta
type Story = StoryObj<typeof meta>

export const ModeratorAttribution: Story = {}

export const MetadataNewerThanReview: Story = {
  parameters: mockResponse({
    ...response,
    metadata_changed_at: { general: hoursAgo(1) },
  }),
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement.ownerDocument.body)
    await expect(
      await dialog.findByText(
        /Metadata changed .*Changed since quality review/,
      ),
    ).toBeVisible()
  },
}

export const MetadataOlderThanReview: Story = {
  parameters: mockResponse({
    ...response,
    metadata_changed_at: { general: hoursAgo(48) },
  }),
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement.ownerDocument.body)
    await expect(await dialog.findByText(/Metadata changed/)).toBeVisible()
    expect(
      dialog.queryByText(/Changed since quality review/),
    ).not.toBeInTheDocument()
  },
}

export const MissingMetadataTimestamp: Story = {
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement.ownerDocument.body)
    await dialog.findByText(/Alex Moderator/)
    expect(dialog.queryByText(/Metadata changed/)).not.toBeInTheDocument()
  },
}

export const AutomatedCheckDoesNotClearStaleReview: Story = {
  parameters: mockResponse({
    ...response,
    guidelines: [
      {
        ...response.guidelines[0],
        guideline_id: "app-name-just-the-name",
        guideline: {
          ...response.guidelines[0].guideline,
          id: "app-name-just-the-name",
          category: "app-name",
        },
        updated_at: hoursAgo(120),
      },
      {
        ...response.guidelines[1],
        guideline_id: "app-name-not-too-long",
        guideline: {
          ...response.guidelines[1].guideline,
          id: "app-name-not-too-long",
          category: "app-name",
          read_only: true,
        },
        updated_at: hoursAgo(24),
      },
    ],
    metadata_changed_at: { "app-name": hoursAgo(72) },
  }),
  play: MetadataNewerThanReview.play,
}
