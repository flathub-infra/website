import { Meta, StoryObj } from "@storybook/nextjs-vite"
import AppModeration from "./AppModeration"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { faker } from "@faker-js/faker"
import { http, HttpResponse } from "msw"
import { ModerationRequestResponse, Permission } from "../../codegen/model"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { UserContext } from "../../context/user-info"

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, refetchOnMount: true } },
})
let discussionClient = new QueryClient()

export default {
  title: "Components/Moderation/AppModeration",
  component: AppModeration,
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/admin/moderation/org.gnome.TextEditor",
        query: {},
      },
    },
  },
  decorators: [
    (Story) => {
      return (
        <QueryClientProvider client={queryClient}>
          <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
            <Story />
          </div>
        </QueryClientProvider>
      )
    },
  ],
} as Meta<typeof AppModeration>

const generateMockRequest = (
  id: number,
  isHandled: boolean = false,
  isOutdated: boolean = false,
  buildId: number = faker.number.int({ min: 100000, max: 200000 }),
  requestType: "appdata" | "summary" = "appdata",
): ModerationRequestResponse => ({
  id,
  app_id: "org.gnome.TextEditor",
  created_at: faker.date.recent({ days: 7 }).toISOString(),
  build_id: buildId,
  job_id: buildId,
  is_outdated: isOutdated,
  request_type: requestType,
  request_data: {
    keys: {
      name: "GNOME Text Editor",
      summary: "Edit text files",
      description: "A simple text editor for GNOME",
    },
    current_values: {
      name: "Text Editor",
      summary: "Edit text files",
      description: "Text editor for the GNOME desktop",
    },
  },
  is_new_submission: false,
  can_open_discussion: true,
  handled_by: isHandled ? "John Doe" : null,
  handled_at: isHandled ? faker.date.recent({ days: 2 }).toISOString() : null,
  is_approved: isHandled ? true : null,
  comment: isHandled ? "Looks good!" : null,
})

const mockAppInfo = {
  id: "org.gnome.TextEditor",
  name: "GNOME Text Editor",
  summary: "Edit text files",
  icon: "https://dl.flathub.org/media/org/gnome/TextEditor/4a225898919db9d4c99e3efb72015bde/icons/128x128/org.gnome.TextEditor.png",
  categories: ["Utility", "TextEditor"],
  metadata: {
    "flathub::manifest":
      "https://github.com/flathub/org.gnome.TextEditor/blob/master/org.gnome.TextEditor.json",
  },
}

export const WithPendingRequests = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/moderation/apps/org.gnome.TextEditor", () => {
          return HttpResponse.json({
            requests: [
              generateMockRequest(1, false, false, 150000),
              generateMockRequest(2, false, false, 150000, "summary"),
              generateMockRequest(3, false, false),
            ],
            requests_count: 3,
          })
        }),
        http.get("*/moderation/apps", () => {
          return HttpResponse.json({
            apps: [
              {
                appid: "org.gnome.Calculator",
                updated_at: new Date().toISOString(),
              },
              {
                appid: "org.gnome.TextEditor",
                updated_at: new Date().toISOString(),
              },
              { appid: "org.gnome.Maps", updated_at: new Date().toISOString() },
            ],
            apps_count: 3,
          })
        }),
        http.post("*/appstream", () => {
          return HttpResponse.json([mockAppInfo])
        }),
      ],
    },
  },
  args: {
    appId: "org.gnome.TextEditor",
  },
}

export const WithHandledRequests = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/admin/moderation/org.gnome.TextEditor",
        query: { includeHandled: "true" },
      },
    },
    msw: {
      handlers: [
        http.get("*/moderation/apps/org.gnome.TextEditor", () => {
          return HttpResponse.json({
            requests: [
              generateMockRequest(1, true, false),
              generateMockRequest(2, true, false),
              generateMockRequest(3, false, false),
            ],
            requests_count: 3,
          })
        }),
        http.get("*/moderation/apps", () => {
          return HttpResponse.json({
            apps: [
              {
                appid: "org.gnome.Calculator",
                updated_at: new Date().toISOString(),
              },
              {
                appid: "org.gnome.TextEditor",
                updated_at: new Date().toISOString(),
              },
              { appid: "org.gnome.Maps", updated_at: new Date().toISOString() },
            ],
            apps_count: 3,
          })
        }),
        http.post("*/appstream", () => {
          return HttpResponse.json([mockAppInfo])
        }),
      ],
    },
  },
  args: {
    appId: "org.gnome.TextEditor",
  },
}

export const WithOutdatedRequests = {
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/admin/moderation/org.gnome.TextEditor",
        query: { includeOutdated: "true" },
      },
    },
    msw: {
      handlers: [
        http.get("*/moderation/apps/org.gnome.TextEditor", () => {
          return HttpResponse.json({
            requests: [
              generateMockRequest(1, false, true),
              generateMockRequest(2, false, false),
            ],
            requests_count: 2,
          })
        }),
        http.get("*/moderation/apps", () => {
          return HttpResponse.json({
            apps: [
              {
                appid: "org.gnome.Calculator",
                updated_at: new Date().toISOString(),
              },
              {
                appid: "org.gnome.TextEditor",
                updated_at: new Date().toISOString(),
              },
              { appid: "org.gnome.Maps", updated_at: new Date().toISOString() },
            ],
            apps_count: 3,
          })
        }),
        http.post("*/appstream", () => {
          return HttpResponse.json([mockAppInfo])
        }),
      ],
    },
  },
  args: {
    appId: "org.gnome.TextEditor",
  },
}

export const EmptyState = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/moderation/apps/org.gnome.TextEditor", () => {
          return HttpResponse.json({
            requests: [],
            requests_count: 0,
          })
        }),
        http.get("*/moderation/apps", () => {
          return HttpResponse.json({
            apps: [
              {
                appid: "org.gnome.TextEditor",
                updated_at: new Date().toISOString(),
              },
            ],
            apps_count: 1,
          })
        }),
        http.post("*/appstream", () => {
          return HttpResponse.json([mockAppInfo])
        }),
      ],
    },
  },
  args: {
    appId: "org.gnome.TextEditor",
  },
}

export const WithNavigation = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/moderation/apps/org.gnome.TextEditor", () => {
          return HttpResponse.json({
            requests: [generateMockRequest(1, false, false)],
            requests_count: 1,
          })
        }),
        http.get("*/moderation/apps", () => {
          return HttpResponse.json({
            apps: [
              {
                appid: "org.gnome.Calculator",
                updated_at: new Date().toISOString(),
              },
              {
                appid: "org.gnome.TextEditor",
                updated_at: new Date().toISOString(),
              },
              { appid: "org.gnome.Maps", updated_at: new Date().toISOString() },
            ],
            apps_count: 3,
          })
        }),
        http.post("*/appstream", () => {
          return HttpResponse.json([mockAppInfo])
        }),
      ],
    },
  },
  args: {
    appId: "org.gnome.TextEditor",
  },
}

export const Loading = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/moderation/apps/org.gnome.TextEditor", async () => {
          await new Promise(() => {}) // Never resolve to show loading state
          return HttpResponse.json({
            requests: [],
            requests_count: 0,
          })
        }),
        http.post("*/appstream", async () => {
          await new Promise(() => {}) // Never resolve to show loading state
          return HttpResponse.json([])
        }),
      ],
    },
  },
  args: {
    appId: "org.gnome.TextEditor",
  },
}

export const Error = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/moderation/apps/org.gnome.TextEditor", () => {
          return HttpResponse.json(
            { detail: "Failed to fetch moderation requests" },
            { status: 500 },
          )
        }),
        http.post("*/appstream", () => {
          return HttpResponse.json([mockAppInfo])
        }),
      ],
    },
  },
  args: {
    appId: "org.gnome.TextEditor",
  },
}

const discussionIssueUrl =
  "https://github.com/flathub/org.gnome.TextEditor/issues/12"
let savedDiscussionUrl: string | undefined
let discussionBodies: unknown[] = []
let reviewBodies: unknown[] = []

export const DiscussionFlow: StoryObj<typeof AppModeration> = {
  beforeEach: () => {
    discussionClient = new QueryClient()
    savedDiscussionUrl = undefined
    discussionBodies = []
    reviewBodies = []
  },
  parameters: {
    msw: {
      handlers: [
        http.get("*/moderation/apps/org.gnome.TextEditor", () => {
          return HttpResponse.json({
            requests: [1, 2].map((id) => ({
              ...generateMockRequest(
                id,
                false,
                false,
                150000,
                id === 1 ? "appdata" : "summary",
              ),
              created_at: "2024-01-01T00:00:00",
              discussion_url: savedDiscussionUrl,
              discussion_opened_by: savedDiscussionUrl && "Jane Doe",
              discussion_comment:
                savedDiscussionUrl && "Please explain why this source changed.",
            })),
            requests_count: 2,
          })
        }),
        http.post(
          "*/moderation/requests/:id/discussion",
          async ({ request }) => {
            discussionBodies.push(await request.json())
            savedDiscussionUrl = discussionIssueUrl
            return HttpResponse.json({ github_issue_url: discussionIssueUrl })
          },
        ),
        http.post("*/moderation/requests/:id/review", async ({ request }) => {
          reviewBodies.push(await request.json())
          return HttpResponse.json(null)
        }),
        http.get("*/moderation/apps", () => {
          return HttpResponse.json({
            apps: [
              {
                appid: "org.gnome.TextEditor",
                updated_at: "2024-01-01T00:00:00",
              },
            ],
            apps_count: 1,
          })
        }),
        http.post("*/appstream", () => {
          return HttpResponse.json([mockAppInfo])
        }),
      ],
    },
  },
  args: {
    appId: "org.gnome.TextEditor",
  },
  render: (args) => (
    <QueryClientProvider client={discussionClient}>
      <UserContext
        value={{
          loading: false,
          info: { permissions: [Permission.moderation] },
        }}
      >
        <AppModeration {...args} />
      </UserContext>
    </QueryClientProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(
      await canvas.findByRole("button", { name: "Open discussion" }),
    )
    const dialog = within(await body.findByRole("dialog"))
    const submit = dialog.getByRole("button", { name: "Open discussion" })
    await expect(submit).toBeDisabled()
    await userEvent.type(dialog.getByLabelText("Comment"), "   ")
    await expect(submit).toBeDisabled()
    await userEvent.clear(dialog.getByLabelText("Comment"))
    await userEvent.type(
      dialog.getByLabelText("Comment"),
      "Please explain why this source changed.",
    )
    await userEvent.click(submit)

    await waitFor(() => expect(body.queryByRole("dialog")).toBeNull())
    await expect(
      await canvas.findByRole("link", { name: "View discussion" }),
    ).toHaveAttribute("href", discussionIssueUrl)
    await expect(
      await canvas.findByText("Discussion opened by Jane Doe"),
    ).toBeInTheDocument()
    await expect(
      canvas.getByText("Please explain why this source changed."),
    ).toBeInTheDocument()
    await expect(discussionBodies).toEqual([
      { comment: "Please explain why this source changed." },
    ])
    await expect(
      canvas.queryByRole("button", { name: "Open discussion" }),
    ).toBeNull()
    const reject = canvas.getByRole("button", { name: "Reject" })
    await expect(reject).toBeDisabled()
    await userEvent.type(canvas.getByLabelText("Review comment"), "   ")
    await expect(reject).toBeDisabled()
    await userEvent.clear(canvas.getByLabelText("Review comment"))
    await userEvent.type(canvas.getByLabelText("Review comment"), "Looks good.")
    await expect(reject).toBeEnabled()

    await userEvent.click(canvas.getByRole("button", { name: "Approve" }))
    await waitFor(() =>
      expect(canvas.queryByRole("button", { name: "Approve" })).toBeNull(),
    )
    await expect(reviewBodies).toEqual([
      { approve: true, comment: "Looks good." },
    ])
  },
}
