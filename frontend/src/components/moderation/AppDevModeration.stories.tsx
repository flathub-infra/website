import { Meta, StoryObj } from "@storybook/nextjs-vite"
import { AppDevModeration } from "./AppDevModeration"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import { expect, within } from "storybook/test"
import { UserContext } from "../../context/user-info"

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, refetchOnMount: true } },
})

export default {
  title: "Components/Moderation/AppDevModeration",
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
  component: AppDevModeration,
  decorators: [
    (Story) => {
      queryClient.setQueryData(["moderation", "tv.abc.TestApp", 10, 0], {
        data: {
          requests: [
            {
              id: 1332,
              app_id: "org.kde.kstars",
              created_at: "2024-09-17T06:47:06.087839",
              build_id: 130350,
              job_id: 234976,
              is_outdated: false,
              request_type: "appdata",
              request_data: {
                keys: { developer_name: "KDE" },
                current_values: {
                  name: "KStars",
                  summary: "Desktop Planetarium",
                  developer_name: null,
                  project_license: "GPL-2.0+",
                },
              },
              is_new_submission: false,
              can_open_discussion: true,
              handled_by: "Bartłomiej Piotrowski",
              handled_at: "2024-09-17T08:02:23.399999",
              is_approved: true,
            },
          ],
          requests_count: 1,
        },
      })
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      )
    },
  ],
} as Meta<typeof AppDevModeration>

export const Primary = () => {
  return <AppDevModeration appId="tv.abc.TestApp" />
}

let historyClient = new QueryClient()
const discussionIssueUrl = "https://github.com/flathub/tv.abc.TestApp/issues/3"

export const DiscussionHistory: StoryObj<typeof AppDevModeration> = {
  beforeEach: () => {
    historyClient = new QueryClient()
  },
  parameters: {
    msw: {
      handlers: [
        http.get("*/moderation/apps/tv.abc.TestApp", () => {
          return HttpResponse.json({
            requests: [
              {
                id: 1400,
                app_id: "tv.abc.TestApp",
                created_at: "2024-01-01T00:00:00",
                build_id: 140000,
                job_id: 240000,
                is_outdated: false,
                request_type: "appdata",
                request_data: {
                  keys: { name: "Test App" },
                  current_values: { name: "Old Test App" },
                },
                is_new_submission: false,
                can_open_discussion: true,
                discussion_url: discussionIssueUrl,
              },
            ],
            requests_count: 1,
          })
        }),
      ],
    },
  },
  render: () => (
    <QueryClientProvider client={historyClient}>
      <UserContext value={{ loading: false, info: { permissions: [] } }}>
        <AppDevModeration appId="tv.abc.TestApp" />
      </UserContext>
    </QueryClientProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole("link", { name: "View discussion" }),
    ).toHaveAttribute("href", discussionIssueUrl)
    for (const name of ["Approve", "Reject", "Open discussion"]) {
      await expect(canvas.queryByRole("button", { name })).toBeNull()
    }
  },
}
