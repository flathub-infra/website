import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import type { GetUserinfoAuthUserinfoGet200 } from "src/codegen"
import ManageClient from "./manage-client"

const mocks = vi.hoisted(() => ({ guard: vi.fn() }))

vi.mock("next-intl", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next-intl")>()),
  useTranslations: () => (key: string) => key,
}))
vi.mock("src/i18n/navigation", () => ({ Link: () => null }))
vi.mock("src/components/LogoImage", () => ({ default: () => null }))
vi.mock("src/context/user-info", () => ({
  useUserContext: () => ({ info: null, loading: false }),
}))
vi.mock("src/components/login/LoginGuard", () => ({
  default: (props: unknown) => {
    mocks.guard(props)
    return null
  },
}))
vi.mock("src/codegen", () => ({
  Permission: {
    moderation: "moderation",
    "modify-users": "modify-users",
    "direct-upload": "direct-upload",
  },
  useGetAppVendingSetupVendingappAppIdSetupGet: () => ({ isSuccess: false }),
  useGetInviteStatusInvitesAppIdGet: () => ({ isSuccess: false }),
}))

describe("app management access", () => {
  it.each([
    {
      name: "unassigned admin",
      apps: [],
      permissions: ["modify-users"],
      allowed: true,
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
        vendingConfig={{
          status: "ok",
          platforms: {},
          fee_fixed_cost: 0,
          fee_cost_percent: 0,
          fee_prefer_percent: 0,
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
