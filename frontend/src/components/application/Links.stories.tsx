import type { Meta, StoryObj } from "@storybook/nextjs"

import Links from "./Links"

const meta = {
  component: Links,
  title: "Components/Application/Links",
} satisfies Meta<typeof Links>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    app: {
      id: "tv.abc.TestApp",
      metadata: {
        "flathub::manifest": "https://github.com/abc/test-app",
      },
      urls: {
        bugtracker: "https://github.com/abc/test-app/issues",
        donation: "https://github.com/abc/test-app",
        homepage: "https://github.com/abc/test-app",
        translate: "https://github.com/abc/test-app",
        help: "https://github.com/abc/test-app",
        faq: "https://github.com/abc/test-app",
        contact: "https://github.com/abc/test-app",
        vcs_browser: "https://github.com/abc/test-app",
        contribute: "https://github.com/abc/test-app",
      },
    },
  },
}
