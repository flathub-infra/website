// @vitest-environment jsdom
import { act, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import type { GetUserinfoAuthUserinfoGet200 } from "src/codegen"
import ManageClient from "./manage-client"

const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  invites: vi.fn(() => ({
    isSuccess: true,
    data: { data: { is_direct_upload_app: false } },
  })),
  vending: vi.fn(() => ({
    isSuccess: true,
    data: { data: { status: "not_setup" } },
  })),
  developersPanel: vi.fn(() => null),
  ownershipPanel: vi.fn(() => null),
  config: vi.fn(() => ({ isError: false, data: { data: {} } })),
  apps: [] as string[],
}))
vi.mock("src/components/application/AppVendingControls/SetupControls", () => ({
  default: () => <input aria-label="payment draft" />,
}))
vi.mock("src/components/application/AppDevelopersControls", () => ({
  default: mocks.developersPanel,
}))
vi.mock(
  "src/components/application/AppVendingControls/OwnershipTokens/TokenList",
  () => ({ default: mocks.ownershipPanel }),
)

vi.mock("next-intl", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next-intl")>()),
  useTranslations: () => (key: string) => key,
}))
vi.mock("src/i18n/navigation", () => ({ Link: () => null }))
vi.mock("src/components/LogoImage", () => ({ default: () => null }))
vi.mock("src/components/application/AppMaintenance", () => ({
  default: () => null,
  AppRuntimeWarning: () => null,
}))
vi.mock("src/components/moderation/AppDevModeration", () => ({
  AppDevModeration: () => <input name="reviews" />,
}))
vi.mock("src/context/user-info", () => ({
  useUserContext: () => ({
    info: { permissions: ["manage-apps"], dev_flatpaks: mocks.apps },
    loading: false,
  }),
}))
vi.mock("src/components/login/LoginGuard", () => ({
  default: (props: { children: ReactNode }) =>
    mocks.guard(props) ? props.children : null,
}))
vi.mock("src/codegen", () => ({
  Permission: {
    moderation: "moderation",
    "modify-users": "modify-users",
    "manage-apps": "manage-apps",
    "direct-upload": "direct-upload",
  },
  useGetManagementVendingSetupVendingappAppIdManagementSetupGet: mocks.vending,
  getGetManagementVendingSetupVendingappAppIdManagementSetupGetQueryKey: (
    id: string,
  ) => [`/vendingapp/${id}/management-setup`],
  useGetGlobalVendingConfigVendingConfigGet: mocks.config,
  useGetInviteStatusInvitesAppIdGet: mocks.invites,
}))

it("loads section data on first entry and preserves visited panels", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  mocks.guard.mockReturnValue(true)
  const host = document.body.appendChild(document.createElement("div"))
  const root = createRoot(host)
  async function select(title: string) {
    const tab = Array.from(host.querySelectorAll('[role="tab"]')).find(
      (el) => el.textContent === title,
    )!
    await act(async () =>
      tab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })),
    )
  }
  try {
    const render = () =>
      act(async () =>
        root.render(
          <ManageClient
            app={{
              id: "org.example.App",
              name: "Example",
              type: "desktop",
              bundle: { type: "flatpak", value: "org.example.App" },
            }}
          />,
        ),
      )
    await render()
    const tabs = () =>
      Array.from(host.querySelectorAll('[role="tab"]'), (el) => el.textContent)
    expect(tabs()).not.toContain("developers")
    expect(tabs()).not.toContain("ownership-tokens")
    expect(tabs()).toContain("app-management.payments")
    expect(tabs()).toContain("danger-zone")
    mocks.invites.mockReturnValue({
      isSuccess: true,
      data: { data: { is_direct_upload_app: true } },
    })
    await render()
    expect(tabs()).toContain("developers")
    expect(tabs()).not.toContain("ownership-tokens")
    mocks.vending.mockReturnValue({
      isSuccess: true,
      data: { data: { status: "ok" } },
    })
    await render()
    expect(tabs()).toContain("ownership-tokens")
    const reviews = host.querySelector<HTMLInputElement>(
      'input[name="reviews"]',
    )!
    reviews.value = "draft"
    expect(mocks.developersPanel).not.toHaveBeenCalled()
    expect(mocks.ownershipPanel).not.toHaveBeenCalled()
    await select("developers")
    await vi.waitFor(() => expect(mocks.developersPanel).toHaveBeenCalled())
    expect(mocks.ownershipPanel).not.toHaveBeenCalled()
    await select("ownership-tokens")
    await vi.waitFor(() => expect(mocks.ownershipPanel).toHaveBeenCalled())
    await select("app-management.reviews")
    expect(
      host.querySelector<HTMLInputElement>('input[name="reviews"]')?.value,
    ).toBe("draft")
  } finally {
    await act(async () => root.unmount())
    host.remove()
    mocks.guard.mockReset()
    vi.unstubAllGlobals()
  }
})

describe("app management access", () => {
  it("keeps payment edits when refreshing a cached global config fails", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
    mocks.apps.push("org.example.App")
    mocks.guard.mockReturnValue(true)
    mocks.vending.mockReturnValue({
      isSuccess: true,
      data: { data: { status: "no-config" } },
    })
    const host = document.body.appendChild(document.createElement("div"))
    const root = createRoot(host)
    const render = () =>
      act(async () =>
        root.render(
          <ManageClient
            app={{
              id: "org.example.App",
              name: "Example",
              type: "desktop",
              bundle: { type: "flatpak", value: "org.example.App" },
            }}
          />,
        ),
      )
    try {
      await render()
      const tab = Array.from(host.querySelectorAll('[role="tab"]')).find(
        (el) => el.textContent === "app-management.payments",
      )!
      await act(async () =>
        tab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })),
      )
      const draft = await vi.waitFor(() => {
        const field = host.querySelector<HTMLInputElement>(
          '[aria-label="payment draft"]',
        )
        expect(field).not.toBeNull()
        return field!
      })
      draft.value = "12.50"
      mocks.config.mockReturnValue({ isError: true, data: { data: {} } })
      await render()
      expect(
        host.querySelector<HTMLInputElement>('[aria-label="payment draft"]')
          ?.value,
      ).toBe("12.50")
    } finally {
      await act(async () => root.unmount())
      host.remove()
      mocks.apps.length = 0
      mocks.config.mockReset()
      mocks.guard.mockReset()
      vi.unstubAllGlobals()
    }
  })
  it.each([
    {
      name: "unassigned admin",
      apps: [],
      permissions: ["manage-apps"],
      allowed: true,
    },
    {
      name: "unassigned user manager",
      apps: [],
      permissions: ["modify-users"],
      allowed: false,
    },
    {
      name: "assigned developer",
      apps: ["org.example.App"],
      permissions: [],
      allowed: true,
    },
    {
      name: "unassigned developer",
      apps: ["org.example.Other"],
      permissions: [],
      allowed: false,
    },
    {
      name: "unassigned moderator",
      apps: [],
      permissions: ["moderation"],
      allowed: false,
    },
    {
      name: "unassigned quality moderator",
      apps: [],
      permissions: ["quality-moderation"],
      allowed: false,
    },
  ])("allows $name: $allowed", ({ apps, permissions, allowed }) => {
    renderToStaticMarkup(
      <ManageClient
        app={{
          id: "org.example.App",
          name: "Example",
          type: "desktop",
          bundle: { type: "flatpak", value: "org.example.App" },
        }}
      />,
    )
    const { condition } = mocks.guard.mock.lastCall![0]
    expect(
      condition({
        dev_flatpaks: apps,
        permissions,
      } as GetUserinfoAuthUserinfoGet200),
    ).toBe(allowed)
  })
})
