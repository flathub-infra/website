import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import { useState } from "react"
import { expect, userEvent, waitFor, within } from "storybook/test"
import type { PermissionReviewDetail as Review } from "src/codegen"
import PermissionReviewDetail from "./PermissionReviewDetail"

const review: Review = {
  assessment_id: 3873,
  app_id: "net.peercoin.peercoin-qt",
  created_at: "2026-10-19T10:42:40.722811",
  outcome: "rejected",
  acceptance_basis: null,
  candidate_kind: "pull_request",
  forge_instance: "github.com",
  source_repository: "flathub/net.peercoin.peercoin-qt",
  pull_request_number: 34,
  pull_request_url:
    "https://github.com/flathub/net.peercoin.peercoin-qt/pull/34",
  target_git_branch: "master",
  destination_channel: "stable",
  flatpak_branch: "stable",
  difference_count: 3,
  superseded_by: null,
  review_url: "",
  pipeline_id: "",
  build_id: 33006,
  built_revision: "example",
  pull_request_head_revision: null,
  base_revision: "example",
  expected_arches: ["x86_64"],
  snapshot_fingerprint: "example-fingerprint",
  comparison_fingerprint: null,
  comparison_source: "baseline",
  candidate_artifacts: [],
  comparison_artifacts: [],
  candidate_snapshot: null,
  comparison_snapshot: null,
  differences: [
    {
      path: ["x86_64", "Context", "filesystems"],
      before: null,
      after: ["xdg-config/kdeglobals:ro"],
    },
    {
      path: ["x86_64", "Context", "sockets"],
      before: ["pulseaudio", "x11"],
      after: ["fallback-x11", "wayland"],
    },
    {
      path: ["x86_64", "Session Bus Policy"],
      before: null,
      after: {
        "org.kde.kconfig.notify": "talk",
        "org.kde.KGlobalSettings": "talk",
        "org.freedesktop.Notifications": "talk",
        "org.kde.StatusNotifierWatcher": "talk",
        "com.canonical.AppMenu.Registrar": "talk",
      },
    },
  ],
  build_checks: [],
  error_code: null,
  error_message: null,
  linked_assessment_id: null,
  decision_id: 1,
  decisions: [
    {
      id: 1,
      assessment_id: 3873,
      created_at: "2026-10-19T10:42:40.722811",
      decision: "rejected",
      reviewer_id: 1,
      reviewer_name: "Bartłomiej Piotrowski",
      rationale:
        "Use the notifications portal instead of accessing org.freedesktop.Notifications directly.",
      fingerprint: "example-fingerprint",
      applies: true,
    },
  ],
}

const handlers = (data: Review) => [
  http.get("*/moderation/permission-reviews/3873", () =>
    HttpResponse.json(data),
  ),
  http.get("*/moderation/permission-reviews", () =>
    HttpResponse.json({
      items: [{ assessment_id: 3874 }, { assessment_id: 3873 }],
      total: 2,
    }),
  ),
  http.post(
    "*/moderation/permission-reviews/3873/decision",
    async ({ request }) => {
      const body = (await request.json()) as {
        decision: string
        rationale: string | null
        fingerprint: string
      }
      if (
        (body.decision === "rejected" || body.decision === "ignored") &&
        !body.rationale?.trim()
      ) {
        return HttpResponse.json(
          { detail: "rationale_required" },
          { status: 400 },
        )
      }
      if (body.fingerprint !== "example-fingerprint") {
        return new HttpResponse(null, { status: 409 })
      }
      return HttpResponse.json({})
    },
  ),
]

const meta = {
  title: "Moderation/Permission review",
  component: PermissionReviewDetail,
  args: { assessmentId: 3873 },
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    msw: { handlers: handlers(review) },
  },
  decorators: [
    (Story) => {
      const [client] = useState(
        () =>
          new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      )
      return (
        <QueryClientProvider client={client}>
          {/* Match the page surface from layout/Main, not the UI background token. */}
          <div className="min-h-screen bg-flathub-lotion dark:bg-flathub-dark-gunmetal">
            <div className="mx-auto max-w-7xl px-4 sm:px-8">
              <Story />
            </div>
          </div>
        </QueryClientProvider>
      )
    },
  ],
} satisfies Meta<typeof PermissionReviewDetail>
export default meta
type Story = StoryObj<typeof meta>

export const Rejected: Story = {}
export const Dark: Story = { globals: { theme: "dark" } }
export const Ignored: Story = {
  parameters: {
    msw: {
      handlers: handlers({
        ...review,
        outcome: "ignored",
        decisions: [
          {
            ...review.decisions[0],
            decision: "ignored",
            rationale: "This review no longer needs a permission decision.",
          },
        ],
      }),
    },
  },
}

export const Pending: Story = {
  parameters: {
    msw: {
      handlers: handlers({ ...review, outcome: "pending", decisions: [] }),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const reject = await canvas.findByRole("button", { name: "Reject" })
    const ignore = canvas.getByRole("button", { name: "Ignore" })
    await expect(ignore).toBeDisabled()
    await expect(reject).toBeDisabled()
    await expect(canvas.getByRole("button", { name: "Approve" })).toBeEnabled()
    await expect(canvas.getByText("No decisions yet.")).toBeInTheDocument()
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Decision rationale" }),
      "   ",
    )
    await expect(reject).toBeDisabled()
    await expect(ignore).toBeDisabled()
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Decision rationale" }),
      "Use the notifications portal.",
    )
    await expect(reject).toBeEnabled()
    await expect(ignore).toBeEnabled()
    await userEvent.click(reject)
    await waitFor(() =>
      expect(
        canvas.getByRole("textbox", { name: "Decision rationale" }),
      ).toHaveValue(""),
    )
    await expect(ignore).toBeDisabled()
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Decision rationale" }),
      "This review no longer needs a permission decision.",
    )
    await expect(ignore).toBeEnabled()
    await userEvent.click(ignore)
    await waitFor(() =>
      expect(
        canvas.getByRole("textbox", { name: "Decision rationale" }),
      ).toHaveValue(""),
    )
    await expect(ignore).toBeDisabled()
  },
}
export const Superseded: Story = {
  parameters: {
    msw: { handlers: handlers({ ...review, superseded_by: 3874 }) },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByText("This assessment cannot be reviewed."),
    ).toBeInTheDocument()
    await expect(canvas.queryByRole("textbox")).not.toBeInTheDocument()
  },
}
