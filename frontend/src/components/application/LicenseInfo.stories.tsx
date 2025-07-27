import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import LicenseInfo from "./LicenseInfo"

const meta = {
  component: LicenseInfo,
  title: "Components/Application/LicenseInfo",
} satisfies Meta<typeof LicenseInfo>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    app: {
      id: "tv.abc.TestApp",
      is_free_license: true,
      project_license: "MIT",
      urls: {
        homepage: "https://github.com/abc/test-app",
        contribute: "https://github.com/abc/test-app",
      },
    },
  },
}

export const NoLinks: Story = {
  args: {
    app: {
      id: "tv.abc.TestApp",
      is_free_license: true,
      project_license: "MIT",
      urls: {},
    },
  },
}

export const Special: Story = {
  args: {
    app: {
      id: "tv.abc.TestApp",
      is_free_license: false,
      project_license: "MIT",
      urls: {
        homepage: "https://github.com/abc/test-app",
        contribute: "https://github.com/abc/test-app",
      },
    },
  },
}

export const NoLicense: Story = {
  args: {
    app: {
      id: "tv.abc.TestApp",
      is_free_license: false,
      project_license: "",
      urls: {
        homepage: "https://github.com/abc/test-app",
        contribute: "https://github.com/abc/test-app",
      },
    },
  },
}

export const Proprietary: Story = {
  args: {
    app: {
      id: "tv.abc.TestApp",
      is_free_license: false,
      project_license: "LicenseRef-proprietary",
      urls: {
        homepage: "https://github.com/abc/test-app",
        contribute: "https://github.com/abc/test-app",
      },
    },
  },
}
