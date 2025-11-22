import UserDetails from "./UserDetails"
import { UserInfoProvider } from "../../context/user-info"
import { faker } from "@faker-js/faker"

import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import type { UserInfo, LoginMethod } from "../../codegen"

const meta: Meta<typeof UserDetails> = {
  title: "Components/User/UserDetails",
  component: UserDetails,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
}

export default meta
type Story = StoryObj<typeof UserDetails>

const mockLogins: LoginMethod[] = [
  { method: "github", name: "GitHub" },
  { method: "gitlab", name: "GitLab" },
  { method: "gnome", name: "GNOME" },
  { method: "kde", name: "KDE" },
]

const mockUserInfoWithGitHub: UserInfo = {
  displayname: "John Doe",
  dev_flatpaks: ["org.example.App1", "org.example.App2"],
  permissions: [],
  owned_flatpaks: ["org.example.App1"],
  invited_flatpaks: ["org.example.App3"],
  invite_code: faker.string.uuid(),
  accepted_publisher_agreement_at: new Date().toISOString(),
  default_account: {
    login: "johndoe",
    avatar: "https://avatars.githubusercontent.com/u/1234567?v=4",
  },
  auths: {
    github: {
      login: "johndoe",
      avatar: "https://avatars.githubusercontent.com/u/1234567?v=4",
    },
  },
}

const mockUserInfoWithMultipleAccounts: UserInfo = {
  displayname: "Jane Smith",
  dev_flatpaks: ["org.example.App1", "org.example.App2"],
  permissions: [],
  owned_flatpaks: ["org.example.App1"],
  invited_flatpaks: [],
  invite_code: faker.string.uuid(),
  accepted_publisher_agreement_at: new Date().toISOString(),
  default_account: {
    login: "janesmith",
    avatar: "https://avatars.githubusercontent.com/u/7654321?v=4",
  },
  auths: {
    github: {
      login: "janesmith",
      avatar: "https://avatars.githubusercontent.com/u/7654321?v=4",
    },
    gitlab: {
      login: "janesmith-gitlab",
      avatar: "https://secure.gravatar.com/avatar/abc123?s=80&d=identicon",
    },
    gnome: {
      login: "janesmith-gnome",
      avatar: "https://secure.gravatar.com/avatar/def456?s=80&d=identicon",
    },
  },
}

export const SingleAccount: Story = {
  args: {
    logins: mockLogins,
  },
  decorators: [
    (Story: React.ComponentType) => (
      <UserInfoProvider
        userContext={{ info: mockUserInfoWithGitHub, loading: false }}
      >
        <Story />
      </UserInfoProvider>
    ),
  ],
}

export const MultipleAccounts: Story = {
  args: {
    logins: mockLogins,
  },
  decorators: [
    (Story: React.ComponentType) => (
      <UserInfoProvider
        userContext={{
          info: mockUserInfoWithMultipleAccounts,
          loading: false,
        }}
      >
        <Story />
      </UserInfoProvider>
    ),
  ],
}

export const WithAvailableLogins: Story = {
  args: {
    logins: mockLogins,
  },
  decorators: [
    (Story: React.ComponentType) => (
      <UserInfoProvider
        userContext={{ info: mockUserInfoWithGitHub, loading: false }}
      >
        <Story />
      </UserInfoProvider>
    ),
  ],
}

export const AllAccountsLinked: Story = {
  args: {
    logins: mockLogins,
  },
  decorators: [
    (Story: React.ComponentType) => (
      <UserInfoProvider
        userContext={{
          info: {
            ...mockUserInfoWithMultipleAccounts,
            auths: {
              github: {
                login: "user-github",
                avatar: "https://avatars.githubusercontent.com/u/1111111?v=4",
              },
              gitlab: {
                login: "user-gitlab",
                avatar:
                  "https://secure.gravatar.com/avatar/111?s=80&d=identicon",
              },
              gnome: {
                login: "user-gnome",
                avatar:
                  "https://secure.gravatar.com/avatar/222?s=80&d=identicon",
              },
              kde: {
                login: "user-kde",
                avatar:
                  "https://secure.gravatar.com/avatar/333?s=80&d=identicon",
              },
            },
          },
          loading: false,
        }}
      >
        <Story />
      </UserInfoProvider>
    ),
  ],
}

export const NotLoggedIn: Story = {
  args: {
    logins: mockLogins,
  },
  decorators: [
    (Story: React.ComponentType) => (
      <UserInfoProvider userContext={{ info: undefined, loading: false }}>
        <Story />
      </UserInfoProvider>
    ),
  ],
}
