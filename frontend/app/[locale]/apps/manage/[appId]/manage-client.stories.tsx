import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"
import { http, HttpResponse } from "msw"
import { expect, userEvent, within } from "storybook/test"
import { getRouter } from "@storybook/nextjs-vite/navigation.mock"
import { UserContext, UserDispatchContext } from "src/context/user-info"
import { getGetUserinfoAuthUserinfoGetResponseMock } from "src/codegen/auth/auth.msw"
import ManageClient from "./manage-client"

const appId = "org.filezillaproject.Filezilla"
const user = getGetUserinfoAuthUserinfoGetResponseMock()

function Providers({
  children,
  managedAppId,
}: {
  children: ReactNode
  managedAppId: string
}) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  )
  return (
    <QueryClientProvider client={client}>
      <UserContext
        value={{
          loading: false,
          info: {
            ...user,
            dev_flatpaks: [managedAppId],
            permissions: ["direct-upload", "moderation", "modify-users"],
          },
        }}
      >
        <UserDispatchContext value={() => {}}>{children}</UserDispatchContext>
      </UserContext>
    </QueryClientProvider>
  )
}

const handlers = [
  http.get("*/invites/:appId/developers", () =>
    HttpResponse.json({ developers: [], invites: [] }),
  ),
  http.get("*/summary/:appId", () =>
    HttpResponse.json({
      metadata: {
        runtime: "org.freedesktop.Platform/x86_64/25.08",
        runtimeIsEol: false,
      },
    }),
  ),
  http.get("*/invites/:appId", () =>
    HttpResponse.json({ is_pending: false, is_direct_upload_app: false }),
  ),
  http.get("*/moderation/apps/:appId", ({ request }) => {
    const history =
      new URL(request.url).searchParams.get("include_handled") === "true"
    return HttpResponse.json({
      requests_count: history ? 1 : 0,
      requests: history
        ? [
            {
              id: 2970,
              app_id: appId,
              request_type: "appdata",
              build_id: 180651,
              job_id: 1,
              created_at: "2025-04-25T12:00:00",
              handled_at: "2025-04-25T13:00:00",
              handled_by: "Flathub",
              is_approved: true,
              is_outdated: true,
              is_new_submission: false,
              can_open_discussion: false,
              request_data: {
                current_values: { developer_name: "" },
                keys: { developer_name: "Tim Kosse" },
              },
            },
          ]
        : [],
    })
  }),
  http.get("*/upload-tokens/:appId", () =>
    HttpResponse.json({ allowed_repos: ["beta"], tokens: [] }),
  ),
  http.get("*/verification/:appId/status", () =>
    HttpResponse.json({ verified: false }),
  ),
  http.get("*/verification/:appId/available-methods", () =>
    HttpResponse.json([]),
  ),
  http.get("*/vendingapp/:appId/setup", () =>
    HttpResponse.json({
      status: "not_setup",
      recommended_donation: 0,
      minimum_payment: 0,
      appshare: 50,
    }),
  ),
  http.get("*/vending/status", () =>
    HttpResponse.json({ details_submitted: false }),
  ),
]

const meta = {
  title: "Pages/Manage app",
  component: ManageClient,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: `/apps/manage/${appId}` },
    },
    msw: { handlers },
  },
  decorators: [
    (Story, context) => (
      <Providers managedAppId={context.args.app.id}>
        <Story />
      </Providers>
    ),
  ],
  args: {
    app: {
      id: appId,
      name: "FileZilla",
      type: "desktop",
      icon: "https://dl.flathub.org/media/org/filezillaproject/Filezilla/5160b88ed6c01ce752c9e46f86093d6e/icons/128x128/org.filezillaproject.Filezilla.png",
      bundle: { value: appId, type: "flatpak" },
      metadata: { "flathub::manifest": null },
    },
    vendingConfig: {
      status: "ok",
      platforms: {},
      fee_fixed_cost: 0,
      fee_cost_percent: 0,
      fee_prefer_percent: 0,
    },
  },
} satisfies Meta<typeof ManageClient>

export default meta
type Story = StoryObj<typeof meta>

export const RepositoryManaged: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole("link", { name: "Packaging repository" }),
    ).toHaveAttribute("href", `https://github.com/flathub/${appId}`)
    await expect(
      await canvas.findByText("No changes awaiting review"),
    ).toBeVisible()
    canvas.getByRole("tab", { name: "Reviews" }).focus()
    await userEvent.keyboard("{ArrowDown}")
    await expect(
      canvas.getByRole("tabpanel", { name: "Verification" }),
    ).toBeVisible()
    await userEvent.keyboard("{ArrowUp}")
    await expect(
      canvas.getByRole("tabpanel", { name: "Reviews" }),
    ).toBeVisible()
    await userEvent.click(
      canvas.getByRole("checkbox", { name: "Include past reviews" }),
    )
    await expect(getRouter().replace).toHaveBeenCalledWith(
      `/apps/manage/${appId}?reviewHistory=true`,
      { scroll: false },
    )
  },
}
export const ReviewHistory: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: `/apps/manage/${appId}`,
        query: { reviewHistory: "true" },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText("Tim Kosse")).toBeVisible()
    await expect(
      canvas.getByRole("checkbox", { name: "Include past reviews" }),
    ).toBeChecked()
    await userEvent.click(
      canvas.getByRole("checkbox", { name: "Include past reviews" }),
    )
    await expect(getRouter().replace).toHaveBeenCalledWith(
      `/apps/manage/${appId}?`,
      { scroll: false },
    )
  },
}
export const LongName: Story = {
  args: {
    app: { ...meta.args.app, name: "ExpressLRS Configurator", icon: "" },
  },
}
export const DirectUpload: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/invites/:appId", () =>
          HttpResponse.json({ is_pending: false, is_direct_upload_app: true }),
        ),
        ...handlers.filter(
          (handler) => handler.info.path !== "*/invites/:appId",
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole("tab", { name: "Developers" }),
    ).toBeInTheDocument()
    await expect(
      canvas.getByRole("link", { name: "Packaging repository" }),
    ).toHaveAttribute("href", `https://github.com/flathub/${appId}`)
  },
}

export const Runtime: Story = {
  args: {
    app: {
      ...meta.args.app,
      id: "org.freedesktop.Sdk.Extension.node20",
      name: "Node.js 20.x",
      icon: "",
      type: "runtime",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      await canvas.findByRole("link", { name: "View builds" }),
    ).toHaveAttribute(
      "href",
      "/builds/apps/org.freedesktop.Sdk.Extension.node20",
    )
    await expect(
      canvas.queryByRole("region", { name: "Maintenance" }),
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("tab", { name: "Verification" }),
    ).not.toBeInTheDocument()
  },
}
