import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import React from "react"
import SafetyRating from "./components/application/SafetyRating"
import { Appstream } from "./types/Appstream"
import { Metadata } from "./types/Summary"

const meta = {
  component: SafetyRating,
  title: "Components/Safety/SafetyRating",
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div className="w-80 border rounded-lg">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SafetyRating>

export default meta

type Story = StoryObj<typeof meta>

const createAppData = (
  overrides: Partial<{
    name: string
    project_license: string
    is_free_license: boolean
    verified: boolean
  }> = {},
) => ({
  name: overrides.name || "Example App",
  project_license: overrides.project_license || "GPL-3.0+",
  is_free_license: overrides.is_free_license ?? true,
  metadata:
    overrides.verified !== undefined
      ? {
          "flathub::verification::verified": overrides.verified,
        }
      : undefined,
})

const createMetadata = (
  overrides: Partial<{
    shared: string[]
    sockets: string[]
    devices: string[]
    filesystems: string[]
    sessionBusTalk: string[]
    sessionBusOwn: string[]
    runtimeIsEol: boolean
  }> = {},
): Pick<Metadata, "permissions" | "runtimeIsEol"> => ({
  permissions: {
    shared: overrides.shared || [],
    sockets: overrides.sockets || [],
    devices: overrides.devices || [],
    filesystems: overrides.filesystems || [],
    "session-bus": {
      talk: overrides.sessionBusTalk || [],
      own: overrides.sessionBusOwn || [],
    },
  },
  runtimeIsEol: overrides.runtimeIsEol || false,
})

export const SafeApp: Story = {
  args: {
    data: createAppData({ verified: true }),
    summaryMetadata: createMetadata(),
  },
}

export const ProbablySafeApp: Story = {
  args: {
    data: createAppData(),
    summaryMetadata: createMetadata({ shared: ["network"] }),
  },
}

export const PotentiallyUnsafeApp: Story = {
  args: {
    data: createAppData(),
    summaryMetadata: createMetadata({
      filesystems: ["home"],
      shared: ["network"],
    }),
  },
}

export const UnsafeApp: Story = {
  args: {
    data: createAppData(),
    summaryMetadata: createMetadata({
      filesystems: ["host"],
      sockets: ["x11"],
      shared: ["network"],
    }),
  },
}

export const ProprietaryApp: Story = {
  args: {
    data: createAppData({
      project_license: "Proprietary",
      is_free_license: false,
    }),
    summaryMetadata: createMetadata({ shared: ["network"] }),
  },
}

export const EOLRuntimeApp: Story = {
  args: {
    data: createAppData(),
    summaryMetadata: createMetadata({
      runtimeIsEol: true,
      shared: ["network"],
    }),
  },
}

export const MaximumPermissionsApp: Story = {
  args: {
    data: createAppData({
      project_license: "Proprietary",
      is_free_license: false,
    }),
    summaryMetadata: createMetadata({
      runtimeIsEol: true,
      shared: ["network"],
      sockets: ["x11", "system-bus", "session-bus", "pulseaudio", "gpg-agent"],
      devices: ["all"],
      filesystems: [
        "host",
        "xdg-download",
        "xdg-run/pipewire-0",
        "xdg-data/flatpak/overrides:create",
      ],
      sessionBusTalk: ["ca.desrt.dconf", "org.freedesktop.flatpak"],
    }),
  },
}

export const InputDeviceApp: Story = {
  args: {
    data: createAppData(),
    summaryMetadata: createMetadata({
      devices: ["input"],
      shared: ["network"],
    }),
  },
}

export const SystemDeviceApp: Story = {
  args: {
    data: createAppData(),
    summaryMetadata: createMetadata({
      devices: ["shm", "kvm"],
      shared: ["network"],
    }),
  },
}

export const DownloadFolderApp: Story = {
  args: {
    data: createAppData(),
    summaryMetadata: createMetadata({
      filesystems: ["xdg-download"],
      shared: ["network"],
    }),
  },
}

export const ReadOnlyHomeFolderApp: Story = {
  args: {
    data: createAppData(),
    summaryMetadata: createMetadata({
      filesystems: ["home:ro"],
      shared: ["network"],
    }),
  },
}

export const SpecificFolderApp: Story = {
  args: {
    data: createAppData(),
    summaryMetadata: createMetadata({
      filesystems: [
        "xdg-documents/Projects",
        "xdg-pictures/Photos:ro",
        "~/work-files",
      ],
      shared: ["network"],
    }),
  },
}

export const MediaAccessApp: Story = {
  args: {
    data: createAppData(),
    summaryMetadata: createMetadata({
      sockets: ["pulseaudio"],
      filesystems: ["xdg-run/pipewire-0"],
      shared: ["network"],
    }),
  },
}

export const LegacyX11App: Story = {
  args: {
    data: createAppData(),
    summaryMetadata: createMetadata({
      sockets: ["fallback-x11"],
      shared: ["network"],
    }),
  },
}

export const WaylandApp: Story = {
  args: {
    data: createAppData(),
    summaryMetadata: createMetadata({
      sockets: ["wayland", "fallback-x11"],
      shared: ["network"],
    }),
  },
}

export const UserSettingsApp: Story = {
  args: {
    data: createAppData(),
    summaryMetadata: createMetadata({
      sessionBusTalk: ["ca.desrt.dconf"],
      shared: ["network"],
    }),
  },
}

export const OfflineApp: Story = {
  args: {
    data: createAppData({ verified: true }),
    summaryMetadata: createMetadata({
      filesystems: ["xdg-documents"],
    }),
  },
}

export const GamingApp: Story = {
  args: {
    data: createAppData({ name: "Epic Game" }),
    summaryMetadata: createMetadata({
      devices: ["input", "shm"],
      sockets: ["x11"],
      shared: ["network"],
    }),
  },
}

export const DevelopmentApp: Story = {
  args: {
    data: createAppData({ name: "Code Editor" }),
    summaryMetadata: createMetadata({
      filesystems: ["home", "host-os", "/tmp"],
      sockets: ["session-bus", "system-bus"],
      devices: ["input"],
      shared: ["network"],
      sessionBusTalk: ["ca.desrt.dconf"],
    }),
  },
}

export const MediaPlayerApp: Story = {
  args: {
    data: createAppData({ name: "Media Player" }),
    summaryMetadata: createMetadata({
      sockets: ["pulseaudio"],
      filesystems: ["xdg-videos", "xdg-music", "xdg-pictures"],
      devices: ["input"],
      shared: ["network"],
    }),
  },
}

export const BrowserApp: Story = {
  args: {
    data: createAppData({ name: "Web Browser" }),
    summaryMetadata: createMetadata({
      shared: ["network"],
      sockets: ["x11"],
      filesystems: ["xdg-download", "xdg-documents", "xdg-desktop"],
      devices: ["input"],
    }),
  },
}
