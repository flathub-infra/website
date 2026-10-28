import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import { useState } from "react"
import { expect, userEvent, waitFor, within } from "storybook/test"
import type { PermissionRuleEntry, PermissionRulePreview } from "src/codegen"
import PermissionRuleList from "./PermissionRuleList"

const rules: PermissionRuleEntry[] = [
  {
    id: 1,
    decision: "approved",
    permission_group: "Session Bus Policy",
    key: "org.kde.StatusNotifierWatcher",
    match_type: "destination",
    before: null,
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
    match_type: "destination",
    before: null,
    value: "talk",
    rationale:
      "Use the notifications portal instead of accessing org.freedesktop.Notifications directly.",
    enabled: true,
    updated_at: "2026-10-24T19:21:00.000000",
    updated_by_name: "Bartłomiej Piotrowski",
  },
  {
    id: 3,
    decision: "approved",
    permission_group: "Context",
    key: "filesystems",
    match_type: "transition",
    before: "xdg-config/kdeglobals",
    value: "xdg-config/kdeglobals:ro",
    rationale: "Allow this exact change to read-only access.",
    enabled: true,
    updated_at: "2026-10-24T19:22:00.000000",
    updated_by_name: "Bartłomiej Piotrowski",
  },
  {
    id: 4,
    decision: "approved",
    permission_group: "Session Bus Policy",
    key: "org.example.Removed",
    match_type: "transition",
    before: "talk",
    value: null,
    rationale: "Allow removal of this bus permission.",
    enabled: true,
    updated_at: "2026-10-24T19:23:00.000000",
    updated_by_name: "Bartłomiej Piotrowski",
  },
  {
    id: 5,
    decision: "rejected",
    permission_group: "System Bus Policy",
    key: "org.example.Restricted",
    match_type: "transition",
    before: null,
    value: "none",
    rationale: "Keep literal none distinct from an absent policy.",
    enabled: false,
    updated_at: "2026-10-24T19:24:00.000000",
    updated_by_name: "Bartłomiej Piotrowski",
  },
  {
    id: 6,
    decision: "approved",
    permission_group: "Context",
    key: "devices",
    match_type: "grouped-delta",
    before: null,
    value: null,
    removed: [],
    added: ["all", "if:all:!has-input-device", "input"],
    rationale:
      "Allow this ordered Jellyfin device delta while preserving unchanged dri access.",
    enabled: true,
    updated_at: "2026-10-27T10:00:00.000000",
    updated_by_name: "Bartłomiej Piotrowski",
  },
  {
    id: 7,
    decision: "approved",
    permission_group: "Context",
    key: "devices",
    match_type: "grouped-delta",
    before: null,
    value: null,
    removed: ["dri"],
    added: [],
    required: ["all"],
    rationale: "Remove redundant dri access while all device access remains.",
    enabled: true,
    updated_at: "2026-10-28T10:00:00.000000",
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
  http.put("*/moderation/permission-rules/:id", async ({ request, params }) =>
    HttpResponse.json({
      ...rules.find((rule) => rule.id === Number(params.id)),
      ...((await request.json()) as object),
    }),
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

const selectOption = async (
  dialog: ReturnType<typeof within>,
  label: string,
  name: string,
) => {
  const body = within(document.body)
  await userEvent.click(dialog.getByLabelText(label))
  await userEvent.click(await body.findByRole("option", { name }))
  // Radix keeps the dialog hidden and pointer-blocked until the exit animation
  // finishes. The selected value updates before the portal has been removed.
  await waitFor(() =>
    expect(
      body.queryByRole("listbox", { hidden: true }),
    ).not.toBeInTheDocument(),
  )
}

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

export const EditRemoval: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole("button", {
        name: "Edit rule org.example.Removed: talk → Absent",
      }),
    )
    const body = within(document.body)
    const dialog = within(await body.findByRole("dialog"))
    await expect(dialog.getByLabelText("Match")).toHaveTextContent(
      "Exact transition",
    )
    await expect(dialog.getByLabelText("Before policy")).toHaveTextContent(
      "talk",
    )
    await expect(dialog.getByLabelText("After policy")).toHaveTextContent(
      "Absent",
    )
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled()
    await userEvent.click(dialog.getByRole("button", { name: "Preview" }))
    await expect(
      await dialog.findByRole("button", { name: "Save despite conflicts" }),
    ).toBeEnabled()
    await selectOption(dialog, "After policy", "none")
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled()
    await expect(dialog.getByRole("button", { name: "Preview" })).toBeEnabled()
    await selectOption(dialog, "Before policy", "none")
    await expect(dialog.getByRole("button", { name: "Preview" })).toBeDisabled()
    await selectOption(dialog, "Before policy", "Absent")
    await expect(dialog.getByRole("button", { name: "Preview" })).toBeEnabled()
    await selectOption(dialog, "After policy", "Absent")
    await expect(dialog.getByRole("button", { name: "Preview" })).toBeDisabled()
  },
}

export const EditReduction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole("button", {
        name: "Edit rule filesystems: xdg-config/kdeglobals → xdg-config/kdeglobals:ro",
      }),
    )
    const body = within(document.body)
    const dialog = within(await body.findByRole("dialog"))
    await expect(dialog.getByLabelText("Before entry")).toHaveTextContent(
      "Present",
    )
    await expect(dialog.getByLabelText("Before entry value")).toHaveValue(
      "xdg-config/kdeglobals",
    )
    await expect(dialog.getByLabelText("After entry value")).toHaveValue(
      "xdg-config/kdeglobals:ro",
    )
    await userEvent.clear(dialog.getByLabelText("After entry value"))
    await expect(dialog.getByRole("button", { name: "Preview" })).toBeDisabled()
    await userEvent.type(
      dialog.getByLabelText("After entry value"),
      "xdg-config/kdeglobals",
    )
    await expect(dialog.getByRole("button", { name: "Preview" })).toBeDisabled()
    await userEvent.type(dialog.getByLabelText("After entry value"), ":ro")
    await userEvent.click(dialog.getByRole("button", { name: "Preview" }))
    await expect(
      await dialog.findByRole("button", { name: "Save despite conflicts" }),
    ).toBeEnabled()
    await selectOption(dialog, "Match", "Destination-only")
    await expect(
      dialog.queryByLabelText("Before entry"),
    ).not.toBeInTheDocument()
    await expect(dialog.getByLabelText("Entry")).toHaveValue(
      "xdg-config/kdeglobals:ro",
    )
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled()
    await selectOption(dialog, "Match", "Exact transition")
    await expect(dialog.getByLabelText("Before entry")).toHaveTextContent(
      "Absent",
    )
    await expect(dialog.getByLabelText("After entry value")).toHaveValue(
      "xdg-config/kdeglobals:ro",
    )
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled()
  },
}

export const CreateTransition: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole("button", { name: "New rule" }),
    )
    const body = within(document.body)
    const dialogElement = await body.findByRole("dialog")
    const dialog = within(dialogElement)
    await expect(dialog.getByLabelText("Match")).toHaveTextContent(
      "Destination-only",
    )
    await selectOption(dialog, "Match", "Exact transition")
    await expect(dialog.getByLabelText("Before policy")).toHaveTextContent(
      "Absent",
    )
    await userEvent.type(dialog.getByLabelText("Bus name"), "org.example.Bus")
    await userEvent.type(
      dialog.getByLabelText("Rationale"),
      "Handle this exact addition.",
    )
    await selectOption(dialog, "After policy", "none")
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled()
    await userEvent.click(dialog.getByRole("button", { name: "Preview" }))
    await userEvent.click(
      await dialog.findByRole("button", { name: "Save despite conflicts" }),
    )
    await waitFor(() => expect(dialogElement).not.toBeInTheDocument())
  },
}

export const JellyfinGroupedDelta: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole("button", {
        name: "Edit rule devices: remove [] → add [all, if:all:!has-input-device, input] (atomic group)",
      }),
    )
    const body = within(document.body)
    const dialog = within(await body.findByRole("dialog"))
    await expect(dialog.getByLabelText("Match")).toHaveTextContent(
      "Grouped delta",
    )
    await expect(dialog.getByLabelText("Removed entries")).toHaveValue("")
    await expect(dialog.getByLabelText("Added entries")).toHaveValue(
      "all\nif:all:!has-input-device\ninput",
    )
    await expect(dialog.queryByLabelText("Entry")).not.toBeInTheDocument()
    await userEvent.type(dialog.getByLabelText("Removed entries"), "all")
    await expect(dialog.getByRole("button", { name: "Preview" })).toBeDisabled()
    await userEvent.clear(dialog.getByLabelText("Removed entries"))
    await userEvent.type(dialog.getByLabelText("Added entries"), "\ninput")
    await expect(dialog.getByRole("button", { name: "Preview" })).toBeDisabled()
    await userEvent.clear(dialog.getByLabelText("Added entries"))
    await expect(dialog.getByRole("button", { name: "Preview" })).toBeDisabled()
    await userEvent.type(
      dialog.getByLabelText("Added entries"),
      "all\nif:all:!has-input-device\ninput",
    )
    await userEvent.click(dialog.getByRole("button", { name: "Preview" }))
    await expect(
      await dialog.findByRole("button", { name: "Save despite conflicts" }),
    ).toBeEnabled()
    await userEvent.click(dialog.getByLabelText("Group"))
    await userEvent.click(
      await body.findByRole("option", { name: "Session Bus Policy" }),
    )
    await expect(dialog.getByLabelText("Match")).toHaveTextContent(
      "Destination-only",
    )
    await expect(
      dialog.queryByLabelText("Added entries"),
    ).not.toBeInTheDocument()
    await expect(dialog.getByLabelText("Bus name")).toHaveValue("")
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled()
  },
}

export const CreateGroupedDelta: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(
      await canvas.findByRole("button", { name: "New rule" }),
    )
    const body = within(document.body)
    const dialogElement = await body.findByRole("dialog")
    const dialog = within(dialogElement)
    await userEvent.click(dialog.getByLabelText("Group"))
    await userEvent.click(await body.findByRole("option", { name: "Context" }))
    await userEvent.click(dialog.getByLabelText("Match"))
    await userEvent.click(
      await body.findByRole("option", { name: "Grouped delta" }),
    )
    await userEvent.type(dialog.getByLabelText("Key"), "devices")
    await userEvent.type(
      dialog.getByLabelText("Added entries"),
      "all\nif:all:!has-input-device\ninput",
    )
    await userEvent.type(
      dialog.getByLabelText("Rationale"),
      "Preserve unchanged dri access for Jellyfin.",
    )
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled()
    await userEvent.click(dialog.getByRole("button", { name: "Preview" }))
    await userEvent.click(
      await dialog.findByRole("button", { name: "Save despite conflicts" }),
    )
    await waitFor(() => expect(dialogElement).not.toBeInTheDocument())
  },
}
