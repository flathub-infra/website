import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import React from "react"
import SafetyRating from "./components/application/SafetyRating"
import { Appstream } from "./types/Appstream"
import { Metadata } from "./types/Summary"
import { getSafetyRating } from "./safety"

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
    appName: "Example App",
    safetyRating: getSafetyRating(
      createAppData({ verified: true }),
      createMetadata(),
    ),
  },
}

export const ProbablySafeApp: Story = {
  args: {
    appName: "Example App",
    safetyRating: getSafetyRating(
      createAppData(),
      createMetadata({ shared: ["network"] }),
    ),
  },
}

export const PotentiallyUnsafeApp: Story = {
  args: {
    appName: "Example App",
    safetyRating: getSafetyRating(
      createAppData(),
      createMetadata({
        filesystems: ["home"],
        shared: ["network"],
      }),
    ),
  },
}

export const UnsafeApp: Story = {
  args: {
    appName: "Example App",
    safetyRating: getSafetyRating(
      createAppData(),
      createMetadata({
        filesystems: ["host"],
        sockets: ["x11"],
        shared: ["network"],
      }),
    ),
  },
}

export const ProprietaryApp: Story = {
  args: {
    appName: "Example App",
    safetyRating: getSafetyRating(
      createAppData({
        project_license: "Proprietary",
        is_free_license: false,
      }),
      createMetadata({ shared: ["network"] }),
    ),
  },
}

export const EOLRuntimeApp: Story = {
  args: {
    appName: "Example App",
    safetyRating: getSafetyRating(
      createAppData(),
      createMetadata({
        runtimeIsEol: true,
        shared: ["network"],
      }),
    ),
  },
}

export const MaximumPermissionsApp: Story = {
  args: {
    appName: "Example App",
    safetyRating: getSafetyRating(
      createAppData({
        project_license: "Proprietary",
        is_free_license: false,
      }),
      createMetadata({
        runtimeIsEol: true,
        shared: ["network"],
        sockets: [
          "x11",
          "system-bus",
          "session-bus",
          "pulseaudio",
          "gpg-agent",
        ],
        devices: ["all"],
        filesystems: [
          "host",
          "xdg-download",
          "xdg-run/pipewire-0",
          "xdg-data/flatpak/overrides:create",
        ],
        sessionBusTalk: ["ca.desrt.dconf", "org.freedesktop.flatpak"],
      }),
    ),
  },
}

export const InputDeviceApp: Story = {
  args: {
    appName: "Example App",
    safetyRating: getSafetyRating(
      createAppData(),
      createMetadata({
        devices: ["input"],
        shared: ["network"],
      }),
    ),
  },
}

export const SystemDeviceApp: Story = {
  args: {
    appName: "Example App",
    safetyRating: getSafetyRating(
      createAppData(),
      createMetadata({
        devices: ["shm", "kvm"],
        shared: ["network"],
      }),
    ),
  },
}

export const DownloadFolderApp: Story = {
  args: {
    appName: "Example App",
    safetyRating: getSafetyRating(
      createAppData(),
      createMetadata({
        filesystems: ["xdg-download"],
        shared: ["network"],
      }),
    ),
  },
}

export const ReadOnlyHomeFolderApp: Story = {
  args: {
    appName: "Example App",
    safetyRating: getSafetyRating(
      createAppData(),
      createMetadata({
        filesystems: ["home:ro"],
        shared: ["network"],
      }),
    ),
  },
}

export const SpecificFolderApp: Story = {
  args: {
    appName: "Example App",
    safetyRating: getSafetyRating(
      createAppData(),
      createMetadata({
        filesystems: [
          "xdg-documents/Projects",
          "xdg-pictures/Photos:ro",
          "~/work-files",
        ],
        shared: ["network"],
      }),
    ),
  },
}

export const MediaAccessApp: Story = {
  args: {
    appName: "Example App",
    safetyRating: getSafetyRating(
      createAppData(),
      createMetadata({
        sockets: ["pulseaudio"],
        filesystems: ["xdg-run/pipewire-0"],
        shared: ["network"],
      }),
    ),
  },
}

export const LegacyX11App: Story = {
  args: {
    appName: "Example App",
    safetyRating: getSafetyRating(
      createAppData(),
      createMetadata({
        sockets: ["fallback-x11"],
        shared: ["network"],
      }),
    ),
  },
}

export const WaylandApp: Story = {
  args: {
    appName: "Example App",
    safetyRating: getSafetyRating(
      createAppData(),
      createMetadata({
        sockets: ["wayland", "fallback-x11"],
        shared: ["network"],
      }),
    ),
  },
}

export const UserSettingsApp: Story = {
  args: {
    appName: "Example App",
    safetyRating: getSafetyRating(
      createAppData(),
      createMetadata({
        sessionBusTalk: ["ca.desrt.dconf"],
        shared: ["network"],
      }),
    ),
  },
}

export const OfflineApp: Story = {
  args: {
    appName: "Example App",
    safetyRating: getSafetyRating(
      createAppData({ verified: true }),
      createMetadata({
        filesystems: ["xdg-documents"],
      }),
    ),
  },
}

export const GamingApp: Story = {
  args: {
    appName: "Epic Game",
    safetyRating: getSafetyRating(
      createAppData({ name: "Epic Game" }),
      createMetadata({
        devices: ["input", "shm"],
        sockets: ["x11"],
        shared: ["network"],
      }),
    ),
  },
}

export const DevelopmentApp: Story = {
  args: {
    appName: "Code Editor",
    safetyRating: getSafetyRating(
      createAppData({ name: "Code Editor" }),
      createMetadata({
        filesystems: ["home", "host-os", "/tmp"],
        sockets: ["session-bus", "system-bus"],
        devices: ["input"],
        shared: ["network"],
        sessionBusTalk: ["ca.desrt.dconf"],
      }),
    ),
  },
}

export const MediaPlayerApp: Story = {
  args: {
    appName: "Media Player",
    safetyRating: getSafetyRating(
      createAppData({ name: "Media Player" }),
      createMetadata({
        sockets: ["pulseaudio"],
        filesystems: ["xdg-videos", "xdg-music", "xdg-pictures"],
        devices: ["input"],
        shared: ["network"],
      }),
    ),
  },
}

export const BrowserApp: Story = {
  args: {
    appName: "Web Browser",
    safetyRating: getSafetyRating(
      createAppData({ name: "Web Browser" }),
      createMetadata({
        shared: ["network"],
        sockets: ["x11"],
        filesystems: ["xdg-download", "xdg-documents", "xdg-desktop"],
        devices: ["input"],
      }),
    ),
  },
}
