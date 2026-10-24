import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import { useState } from "react"
import { expect, userEvent, within } from "storybook/test"
import type { PermissionRuleEntry, PermissionRulePreview } from "src/codegen"
import PermissionRuleList from "./PermissionRuleList"

const rules: PermissionRuleEntry[] = [
  {
    id: 1,
    decision: "approved",
    permission_group: "Session Bus Policy",
    key: "org.kde.StatusNotifierWatcher",
    value: "talk",
    rationale:
      "Registering tray icons through org.kde.StatusNotifierWatcher is considered safe.",
    enabled: true,
    updated_at: "2026-10-24T19:20:00.000000",
    updated_by_name: "Bartłomiej Piotrowski",
  },
  {
    id: 2,
    decision: "rejected",
    permission_group: "Session Bus Policy",
    key: "org.freedesktop.Notifications",
    value: "talk",
    rationale:
      "Use the notifications portal instead of accessing org.freedesktop.Notifications directly.",
    enabled: true,
    updated_at: "2026-10-24T19:21:00.000000",
    updated_by_name: "Bartłomiej Piotrowski",
  },
]

const preview: PermissionRulePreview = {
  pending: [
    { assessment_id: 5468, app_id: "xyz.nokarin.aqloss", decision: "approved" },
    {
      assessment_id: 5473,
      app_id: "com.ktechpit.omnidict",
      decision: "approved",
    },
  ],
  conflicts: [
    {
      assessment_id: 3785,
      app_id: "com.jetbrains.Rider",
      decision: "rejected",
      decision_id: 13,
      moderator_decision: "approved",
    },
  ],
}

const handlers = (items: PermissionRuleEntry[]) => [
  http.get("*/moderation/permission-rules", () => HttpResponse.json(items)),
  http.post("*/moderation/permission-rules/preview", () =>
    HttpResponse.json(preview),
  ),
  http.post("*/moderation/permission-rules/apply", () =>
    HttpResponse.json(preview.pending),
  ),
  http.post("*/moderation/permission-rules", () =>
    HttpResponse.json(rules[0], { status: 201 }),
  ),
]

const meta = {
  title: "Moderation/Permission rules",
  component: PermissionRuleList,
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    msw: { handlers: handlers(rules) },
  },
  decorators: [
    (Story) => {
      const [client] = useState(
        () =>
          new QueryClient({ defaultOptions: { queries: { retry: false } } }),
      )
      return (
        <QueryClientProvider client={client}>
          <div className="min-h-screen bg-flathub-lotion dark:bg-flathub-dark-gunmetal">
            <div className="mx-auto max-w-7xl px-4 sm:px-8">
              <Story />
            </div>
          </div>
        </QueryClientProvider>
      )
    },
  ],
} satisfies Meta<typeof PermissionRuleList>
export default meta
type Story = StoryObj<typeof meta>

export const Light: Story = { globals: { theme: "light" } }
export const Dark: Story = { globals: { theme: "dark" } }
export const Empty: Story = {
  parameters: { msw: { handlers: handlers([]) } },
}
export const SaveNeedsPreview: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole("button", { name: "New rule" }),
    )
    const dialog = within(await within(document.body).findByRole("dialog"))
    await userEvent.type(dialog.getByLabelText("Bus name"), "org.example.Bus")
    await userEvent.type(dialog.getByLabelText("Rationale"), "Fine.")
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled()
    await userEvent.click(dialog.getByRole("button", { name: "Preview" }))
    await expect(
      await dialog.findByText(
        "1 moderator decision disagrees with these rules.",
      ),
    ).toBeInTheDocument()
    await expect(
      dialog.getByRole("button", { name: "Save despite conflicts" }),
    ).toBeEnabled()
  },
}
