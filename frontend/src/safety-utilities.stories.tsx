import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import React, { useTransition } from "react"
import {
  safetyRatingToColor,
  safetyRatingToIcon,
  safetyRatingToTranslationKey,
  getSafetyRating,
} from "./safety"
import { useTranslations } from "next-intl"

const SafetyRatingColorDemo = ({ rating }: { rating: number }) => {
  const t = useTranslations()
  return (
    <div
      className={`px-4 py-2 rounded-full text-sm font-medium ${safetyRatingToColor(rating)}`}
    >
      {t(safetyRatingToTranslationKey(rating))} (Rating {rating})
    </div>
  )
}

const SafetyRatingIconDemo = ({ rating }: { rating: number }) => {
  const t = useTranslations()
  return (
    <div className="flex items-center gap-3">
      <div className={`p-3 rounded-full ${safetyRatingToColor(rating)}`}>
        <div className="w-6 h-6">{safetyRatingToIcon(rating)}</div>
      </div>
      <span className="text-lg font-medium">
        {t(safetyRatingToTranslationKey(rating))}
      </span>
    </div>
  )
}

const SafetyRatingListDemo = ({
  appData,
  summaryData,
}: {
  appData: any
  summaryData: any
}) => {
  const ratings = getSafetyRating(appData, summaryData)
  const t = useTranslations()

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-lg mb-4">Safety Assessment Results:</h3>
      {ratings.map((rating, index) => (
        <div
          key={index}
          className="flex items-start gap-3 p-3 border rounded-lg"
        >
          <div
            className={`p-2 rounded-full flex-shrink-0 ${safetyRatingToColor(rating.safetyRating)}`}
          >
            <div className="w-5 h-5">
              {rating.icon
                ? React.createElement(rating.icon, {
                    className: "w-full h-full",
                  })
                : safetyRatingToIcon(rating.safetyRating)}
            </div>
          </div>
          <div className="flex-1">
            <div className="font-medium">
              {t(rating.title, rating.titleOptions)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {t(rating.description, rating.descriptionOptions)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

const meta = {
  title: "Components/Safety/Utilities",
  parameters: {
    layout: "centered",
  },
} satisfies Meta

export default meta

export const SafetyRatingColors = {
  render: () => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Safety Rating Colors</h2>
      <div className="space-y-2">
        <SafetyRatingColorDemo rating={1} />
        <SafetyRatingColorDemo rating={2} />
        <SafetyRatingColorDemo rating={3} />
        <SafetyRatingColorDemo rating={4} />
      </div>
    </div>
  ),
}

export const SafetyRatingIcons = {
  render: () => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Safety Rating Icons</h2>
      <div className="space-y-3">
        <SafetyRatingIconDemo rating={1} />
        <SafetyRatingIconDemo rating={2} />
        <SafetyRatingIconDemo rating={3} />
        <SafetyRatingIconDemo rating={4} />
      </div>
    </div>
  ),
}

export const SafeAppAnalysis = {
  render: () => (
    <div className="max-w-2xl">
      <SafetyRatingListDemo
        appData={{
          name: "Safe App",
          project_license: "GPL-3.0+",
          is_free_license: true,
          metadata: { "flathub::verification::verified": true },
        }}
        summaryData={{
          permissions: {
            shared: [],
            sockets: [],
            devices: [],
            filesystems: [],
            "session-bus": { talk: [], own: [] },
          },
          runtimeIsEol: false,
        }}
      />
    </div>
  ),
}

export const DangerousAppAnalysis = {
  render: () => (
    <div className="max-w-2xl">
      <SafetyRatingListDemo
        appData={{
          name: "Dangerous App",
          project_license: "Proprietary",
          is_free_license: false,
        }}
        summaryData={{
          permissions: {
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
            "session-bus": {
              talk: ["ca.desrt.dconf", "org.freedesktop.flatpak"],
              own: [],
            },
          },
          runtimeIsEol: true,
        }}
      />
    </div>
  ),
}

export const MediaAppAnalysis = {
  render: () => (
    <div className="max-w-2xl">
      <SafetyRatingListDemo
        appData={{
          name: "Media Player",
          project_license: "GPL-3.0+",
          is_free_license: true,
        }}
        summaryData={{
          permissions: {
            shared: ["network"],
            sockets: ["pulseaudio"],
            devices: ["input"],
            filesystems: ["xdg-videos", "xdg-music", "xdg-pictures"],
            "session-bus": { talk: [], own: [] },
          },
          runtimeIsEol: false,
        }}
      />
    </div>
  ),
}

export const DevelopmentAppAnalysis = {
  render: () => (
    <div className="max-w-2xl">
      <SafetyRatingListDemo
        appData={{
          name: "Code Editor",
          project_license: "MIT",
          is_free_license: true,
        }}
        summaryData={{
          permissions: {
            shared: ["network"],
            sockets: ["session-bus", "system-bus"],
            devices: ["input"],
            filesystems: ["home", "host-os", "/tmp", "xdg-documents/Projects"],
            "session-bus": {
              talk: ["ca.desrt.dconf"],
              own: [],
            },
          },
          runtimeIsEol: false,
        }}
      />
    </div>
  ),
}

export const SpecificFileAccessAnalysis = {
  render: () => (
    <div className="max-w-2xl">
      <SafetyRatingListDemo
        appData={{
          name: "Document Editor",
          project_license: "Apache-2.0",
          is_free_license: true,
        }}
        summaryData={{
          permissions: {
            shared: [],
            sockets: ["wayland", "fallback-x11"],
            devices: [],
            filesystems: [
              "xdg-documents/Work:rw",
              "xdg-pictures/Screenshots:ro",
              "~/important-files",
              "xdg-desktop/shortcuts:create",
            ],
            "session-bus": { talk: [], own: [] },
          },
          runtimeIsEol: false,
        }}
      />
    </div>
  ),
}
