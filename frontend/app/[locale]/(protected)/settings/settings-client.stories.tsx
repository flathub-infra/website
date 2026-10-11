import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { http, HttpResponse } from "msw"
import type { LoginMethod, UserInfo } from "src/codegen"
import { UserInfoProvider } from "src/context/user-info"
import SettingsClient from "./settings-client"

const providers: LoginMethod[] = [
  { method: "github", name: "GitHub" },
  { method: "gitlab", name: "GitLab" },
  { method: "gnome", name: "GNOME GitLab" },
  { method: "kde", name: "KDE GitLab" },
]

const info: UserInfo = {
  displayname: "Kolja",
  dev_flatpaks: [],
  owned_flatpaks: [],
  invited_flatpaks: [],
  permissions: [],
  invite_code: "settings-story",
  accepted_publisher_agreement_at: "2024-01-01T00:00:00Z",
  default_account: { provider: "github", login: "razzeee", avatar: null },
  auths: Object.fromEntries(
    providers.map(({ method }) => [
      method,
      { provider: method, login: "razzeee", avatar: null },
    ]),
  ),
}

const meta = {
  title: "Pages/Settings",
  component: SettingsClient,
  args: { providers },
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    msw: {
      handlers: [
        http.get("*/auth/userinfo", () => HttpResponse.json(info)),
        http.get("*/users/me", () => HttpResponse.json({ id: 8 })),
        http.get("*/auth/passkeys", () =>
          HttpResponse.json({ credentials: [] }),
        ),
      ],
    },
  },
  decorators: [
    (Story) => (
      <UserInfoProvider userContext={{ info, loading: false }}>
        <main>
          <Story />
        </main>
      </UserInfoProvider>
    ),
  ],
} satisfies Meta<typeof SettingsClient>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithPasskeys: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("*/auth/userinfo", () => HttpResponse.json(info)),
        http.get("*/users/me", () => HttpResponse.json({ id: 8 })),
        http.get("*/auth/passkeys", () =>
          HttpResponse.json({
            credentials: [
              {
                id: 1,
                name: "Security key",
                created_at: "2024-01-01T00:00:00Z",
                last_used_at: "2024-01-02T10:00:00Z",
              },
            ],
          }),
        ),
      ],
    },
  },
}
