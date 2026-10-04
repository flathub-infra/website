import { Meta } from "@storybook/nextjs-vite"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import { QualityModerationSlideOver } from "./QualityModerationSlideOver"
import type { DesktopAppstream } from "src/codegen/model"

const appId = "org.example.QualityDemo"
const app = {
  id: appId,
  name: "Quality Demo",
  summary: "An example application used to preview checklist attribution.",
  icon: "https://flathub.org/img/logo/flathub-logo.png",
  branding: [],
} as DesktopAppstream

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, refetchOnMount: true } },
})

export default {
  title: "Components/Application/QualityModerationSlideOver",
  component: QualityModerationSlideOver,
  parameters: {
    nextjs: { appDirectory: true },
    msw: {
      handlers: [
        http.get(`*/quality-moderation/${appId}/moderator`, () =>
          HttpResponse.json({
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
                updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000)
                  .toISOString()
                  .slice(0, 19),
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
                updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000)
                  .toISOString()
                  .slice(0, 19),
                updated_by: null,
              },
            ],
            is_fullscreen_app: false,
            review_requested_at: null,
          }),
        ),
      ],
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
} as Meta<typeof QualityModerationSlideOver>

export const ModeratorAttribution = {
  args: {
    mode: "qualityModerator",
    app,
    isQualityModalOpen: true,
    setIsQualityModalOpen: () => {},
  },
}
