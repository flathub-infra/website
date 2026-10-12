import { Meta, StoryObj } from "@storybook/nextjs-vite"
import ReviewCard from "./ReviewCard"
import { faker } from "@faker-js/faker"
import { ModerationRequestResponse, Permission } from "../../codegen/model"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { UserContext } from "../../context/user-info"
import { UserState } from "../../types/Login"
import { useTranslations } from "next-intl"
import { http, HttpResponse } from "msw"
import { expect, userEvent, waitFor, within } from "storybook/test"
import { useState } from "react"

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, refetchOnMount: true } },
})

const request_id = 1

export default {
  title: "Components/Moderation/ReviewCard",
  component: ReviewCard,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
  decorators: [
    (Story) => {
      queryClient.setQueryData(["review", request_id], {
        data: { github_issue_url: "https://www.flathub.org" },
      })
      return (
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      )
    },
  ],
} as Meta<typeof ReviewCard>

export const PrimaryRejected = () => {
  const t = useTranslations()
  const request: ModerationRequestResponse = {
    request_type: "appdata",
    request_data: {
      keys: {
        Name: "Test App",
      },
      current_values: {
        Name: "Test App",
      },
    },
    id: request_id,
    app_id: "tv.abc.TestApp",
    created_at: faker.date.past().toISOString(),

    build_id: faker.number.int(),
    job_id: faker.number.int(),
    is_outdated: false,

    is_new_submission: true,
    can_open_discussion: true,

    handled_by: "Kolja",
    handled_at: faker.date.past().toISOString(),
    is_approved: false,
    comment: null,
  }

  const userInfo: UserState = {
    loading: false,
    info: {
      permissions: [Permission.moderation],
    },
  }

  return (
    <UserContext value={{ ...userInfo }}>
      <ReviewCard title={t("moderation-appstream")} requests={[request]}>
        <div>Show table here</div>
      </ReviewCard>
    </UserContext>
  )
}

export const Primary = () => {
  const t = useTranslations()
  const request: ModerationRequestResponse = {
    request_type: "appdata",
    request_data: {
      keys: {
        Name: "Test App",
      },
      current_values: {
        Name: "Test App",
      },
    },
    id: request_id,
    app_id: "tv.abc.TestApp",
    created_at: faker.date.past().toISOString(),

    build_id: faker.number.int(),
    job_id: faker.number.int(),
    is_outdated: false,

    is_new_submission: true,
    can_open_discussion: true,

    handled_by: null,
    handled_at: null,
    is_approved: null,
    comment: null,
  }

  const userInfo: UserState = {
    loading: false,
    info: {
      permissions: [Permission.moderation],
    },
  }

  return (
    <UserContext value={{ ...userInfo }}>
      <ReviewCard title={t("moderation-appstream")} requests={[request]}>
        <div>Show table here</div>
      </ReviewCard>
    </UserContext>
  )
}

const moderator: UserState = {
  loading: false,
  info: {
    permissions: [Permission.moderation],
  },
}

const PendingCard = ({ canOpenDiscussion }: { canOpenDiscussion: boolean }) => {
  const [freshClient] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={freshClient}>
      <UserContext value={moderator}>
        <ReviewCard
          title="Build changes"
          requests={[
            {
              request_type: "appdata",
              request_data: {
                keys: { Name: "Test App" },
                current_values: { Name: "Old Test App" },
              },
              id: request_id,
              app_id: "tv.abc.TestApp",
              created_at: "2024-01-01T00:00:00",
              build_id: 4242,
              job_id: 77,
              is_outdated: false,
              is_new_submission: false,
              can_open_discussion: canOpenDiscussion,
              handled_by: null,
              handled_at: null,
              is_approved: null,
              comment: null,
            },
          ]}
        >
          <div>Show table here</div>
        </ReviewCard>
      </UserContext>
    </QueryClientProvider>
  )
}

let discussionAttempts = 0

export const DiscussionError: StoryObj<typeof ReviewCard> = {
  beforeEach: () => {
    discussionAttempts = 0
  },
  parameters: {
    msw: {
      handlers: [
        http.post("*/moderation/requests/:id/discussion", () => {
          discussionAttempts += 1
          return discussionAttempts === 1
            ? HttpResponse.json(
                { detail: "discussion_creation_failed" },
                { status: 502 },
              )
            : HttpResponse.json({
                github_issue_url:
                  "https://github.com/flathub/tv.abc.TestApp/issues/7",
              })
        }),
      ],
    },
  },
  render: () => <PendingCard canOpenDiscussion />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const draft = "Please explain why this source changed."

    await userEvent.click(
      canvas.getByRole("button", { name: "Open discussion" }),
    )
    const dialog = within(await body.findByRole("dialog"))
    const textarea = dialog.getByLabelText("Comment")
    await userEvent.type(textarea, draft)
    await userEvent.click(
      dialog.getByRole("button", { name: "Open discussion" }),
    )

    await expect(await dialog.findByRole("alert")).toBeVisible()
    await expect(textarea).toHaveValue(draft)
    await expect(
      dialog.getByRole("button", { name: "Open discussion" }),
    ).toBeEnabled()

    await userEvent.click(
      dialog.getByRole("button", { name: "Open discussion" }),
    )
    await waitFor(() => expect(body.queryByRole("dialog")).toBeNull())
    await expect(
      await canvas.findByRole("link", { name: "View discussion" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/flathub/tv.abc.TestApp/issues/7",
    )
    await expect(canvas.getByRole("button", { name: "Approve" })).toBeEnabled()
    await expect(canvas.getByRole("button", { name: "Reject" })).toBeEnabled()
    await expect(
      canvas.queryByRole("button", { name: "Open discussion" }),
    ).toBeNull()
    await expect(discussionAttempts).toBe(2)
  },
}

export const DirectUpload: StoryObj<typeof ReviewCard> = {
  render: () => <PendingCard canOpenDiscussion={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("button", { name: "Approve" })).toBeEnabled()
    await expect(canvas.getByRole("button", { name: "Reject" })).toBeEnabled()
    await expect(
      canvas.queryByRole("button", { name: "Open discussion" }),
    ).toBeNull()
  },
}
