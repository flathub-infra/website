import {
  HiOutlineExclamationTriangle,
  HiOutlineWifi,
  HiOutlineArrowDownTray,
  HiOutlineComputerDesktop,
  HiOutlineCheckCircle,
  HiOutlineCheckBadge,
  HiOutlineDocument,
  HiOutlineVideoCameraSlash,
  HiOutlineVideoCamera,
  HiOutlineCpuChip,
  HiExclamationTriangle,
  HiQuestionMarkCircle,
  HiShieldCheck,
} from "react-icons/hi2"
import { Appstream } from "./types/Appstream"
import { Summary } from "./types/Summary"
import React from "react"
import { IconType } from "react-icons"

const isProprietaryRegex = /^LicenseRef-proprietary/i

enum SafetyRating {
  safe = 1,
  probably_safe = 2,
  potentially_unsafe = 3,
  unsafe = 4,
}

interface AppSafetyRating {
  safetyRating: SafetyRating
  description: string
  icon?: IconType
  showOnSummary: boolean
}

export function safetyRatingToColor(safetyRating: SafetyRating): string {
  switch (safetyRating) {
    case SafetyRating.safe:
      return `text-flathub-status-green bg-flathub-status-green/25 dark:bg-flathub-status-green-dark/25 dark:text-flathub-status-green-dark`
    case SafetyRating.probably_safe:
      return `text-flathub-status-yellow bg-flathub-status-yellow/25 dark:bg-flathub-status-yellow-dark/25 dark:text-flathub-status-yellow-dark`
    case SafetyRating.potentially_unsafe:
      return `text-flathub-status-orange bg-flathub-status-orange/25 dark:bg-flathub-status-orange-dark/25 dark:text-flathub-status-orange-dark`
    case SafetyRating.unsafe:
      return `text-flathub-status-red bg-flathub-status-red/25 dark:bg-flathub-status-red-dark/25 dark:text-flathub-status-red-dark`
  }
}

export function safetyRatingToIcon(safetyRating: SafetyRating): JSX.Element {
  switch (safetyRating) {
    case SafetyRating.safe:
      return React.createElement(HiShieldCheck, {
        className: "w-full h-full",
      })
    case SafetyRating.probably_safe:
      return React.createElement(HiShieldCheck, {
        className: "w-full h-full",
      })
    case SafetyRating.potentially_unsafe:
      return React.createElement(HiQuestionMarkCircle, {
        className: "w-full h-full",
      })
    case SafetyRating.unsafe:
      return React.createElement(HiExclamationTriangle, {
        className: "w-full h-full",
      })
  }
}

export function safetyRatingToTranslationKey(
  safetyRating: SafetyRating,
): string {
  switch (safetyRating) {
    case SafetyRating.safe:
      return "safe"
    case SafetyRating.probably_safe:
      return "probably-safe"
    case SafetyRating.potentially_unsafe:
      return "potentially-unsafe"
    case SafetyRating.unsafe:
      return "unsafe"
  }
}

// reimplementation of https://gitlab.gnome.org/GNOME/gnome-software/-/blob/main/src/gs-app-context-bar.c
export function getSafetyRating(
  appstream: Appstream,
  summary: Summary,
): AppSafetyRating[] {
  let appSafetyRating: AppSafetyRating[] = []

  // network
  if (
    summary.metadata.permissions.shared?.some(
      (x) => x.toLowerCase() === "network",
    )
  ) {
    appSafetyRating.push({
      safetyRating: SafetyRating.probably_safe,
      description: "has-network-access",
      icon: HiOutlineWifi,
      showOnSummary: true,
    })
  }

  // system-bus
  if (
    summary.metadata.permissions.sockets?.some(
      (x) => x.toLowerCase() === "system-bus",
    )
  ) {
    appSafetyRating.push({
      safetyRating: SafetyRating.potentially_unsafe,
      description: "uses-system-services",
      showOnSummary: true,
    })
  }

  // session-bus
  if (
    summary.metadata.permissions.sockets?.some(
      (x) => x.toLowerCase() === "session-bus",
    )
  ) {
    appSafetyRating.push({
      safetyRating: SafetyRating.potentially_unsafe,
      description: "uses-session-services",
      showOnSummary: true,
    })
  }

  // devices
  if (
    summary.metadata.permissions.devices?.some((x) => x.toLowerCase() === "all")
  ) {
    appSafetyRating.push({
      safetyRating: SafetyRating.potentially_unsafe,
      description: "can-access-hardware-devices",
      icon: HiOutlineVideoCamera,
      showOnSummary: true,
    })
  } else {
    appSafetyRating.push({
      safetyRating: SafetyRating.safe,
      description: "no-user-device-access",
      icon: HiOutlineVideoCameraSlash,
      showOnSummary: false,
    })
  }

  // system devices
  if (
    summary.metadata.permissions.devices?.some(
      (x) => x.toLowerCase() === "shm",
    ) ||
    summary.metadata.permissions.devices?.some((x) => x.toLowerCase() === "kvm")
  ) {
    appSafetyRating.push({
      safetyRating: SafetyRating.potentially_unsafe,
      description: "can-access-system-devices",
      icon: HiOutlineCpuChip,
      showOnSummary: true,
    })
  }

  // read/write all data
  appSafetyRating.push(...addFileSafetyRatings(summary))

  // can access and change user settings
  if (
    summary.metadata.permissions["session-bus"]?.talk?.some(
      (x) => x.toLowerCase() === "ca.desrt.dconf",
    )
  ) {
    appSafetyRating.push({
      safetyRating: SafetyRating.potentially_unsafe,
      description: "can-access-and-change-user-settings",
      showOnSummary: true,
    })
  }

  // uses legacy windowing system
  if (
    summary.metadata.permissions.sockets?.some(
      (x) => x.toLowerCase() === "x11",
    ) &&
    !summary.metadata.permissions.sockets?.some(
      (x) => x.toLowerCase() === "fallback-x11",
    )
  ) {
    appSafetyRating.push({
      safetyRating: SafetyRating.potentially_unsafe,
      description: "uses-a-legacy-windowing-system",
      icon: HiOutlineComputerDesktop,
      showOnSummary: true,
    })
  }

  // can acquire arbitrary permissions
  if (
    summary.metadata.permissions.filesystems?.some(
      (x) => x.toLowerCase() === "xdg-data/flatpak/overrides:create",
    ) ||
    summary.metadata.permissions["session-bus"]?.talk?.some(
      (x) => x.toLowerCase() === "org.freedesktop.flatpak".toLowerCase(),
    ) ||
    summary.metadata.permissions["session-bus"]?.talk?.some(
      (x) => x.toLowerCase() === "org.freedesktop.impl.portal.permissionstore",
    )
  ) {
    appSafetyRating.push({
      safetyRating: SafetyRating.potentially_unsafe,
      description: "can-acquire-arbitrary-permissions",
      showOnSummary: true,
    })
  }

  if (appSafetyRating.length === 0) {
    appSafetyRating.push({
      safetyRating: SafetyRating.safe,
      description: "no-permissions",
      showOnSummary: true,
    })
  }

  if (summary.metadata.runtimeIsEol) {
    appSafetyRating.push({
      safetyRating: SafetyRating.potentially_unsafe,
      description: "uses-eol-runtime",
      icon: HiOutlineExclamationTriangle,
      showOnSummary: true,
    })
  }

  if (
    !appstream.project_license ||
    appstream.project_license.match(isProprietaryRegex)
  ) {
    appSafetyRating.push({
      safetyRating: SafetyRating.probably_safe,
      description: "proprietary-code",
      icon: HiOutlineExclamationTriangle,
      showOnSummary: true,
    })
  } else {
    appSafetyRating.push({
      safetyRating: SafetyRating.safe,
      description: "auditable-code",
      icon: HiOutlineCheckCircle,
      showOnSummary: true,
    })
  }

  if (
    appstream.metadata &&
    appstream.metadata["flathub::verification::verified"] === "true"
  ) {
    appSafetyRating.push({
      safetyRating: SafetyRating.safe,
      description: "software-developer-verified",
      icon: HiOutlineCheckBadge,
      showOnSummary: true,
    })
  }

  return appSafetyRating
}
function addFileSafetyRatings(summary: Summary): AppSafetyRating[] {
  const appSafetyRating: AppSafetyRating[] = []
  if (
    summary.metadata.permissions.filesystems?.some(
      (x) => x.toLowerCase() === "home",
    ) ||
    summary.metadata.permissions.filesystems?.some(
      (x) => x.toLowerCase() === "home:rw",
    ) ||
    summary.metadata.permissions.filesystems?.some(
      (x) => x.toLowerCase() === "~",
    ) ||
    summary.metadata.permissions.filesystems?.some(
      (x) => x.toLowerCase() === "~:rw",
    ) ||
    summary.metadata.permissions.filesystems?.some(
      (x) => x.toLowerCase() === "host",
    ) ||
    summary.metadata.permissions.filesystems?.some(
      (x) => x.toLowerCase() === "host:rw",
    )
  ) {
    appSafetyRating.push({
      safetyRating: SafetyRating.potentially_unsafe,
      description: "can-read-write-all-your-data",
      icon: HiOutlineDocument,
      showOnSummary: true,
    })
  }

  // read all your data
  if (
    summary.metadata.permissions.filesystems?.some(
      (x) => x.toLowerCase() === "home:ro",
    ) ||
    summary.metadata.permissions.filesystems?.some(
      (x) => x.toLowerCase() === "~:ro",
    ) ||
    summary.metadata.permissions.filesystems?.some(
      (x) => x.toLowerCase() === "host:ro",
    )
  ) {
    appSafetyRating.push({
      safetyRating: SafetyRating.potentially_unsafe,
      description: "can-read-all-your-data",
      icon: HiOutlineDocument,
      showOnSummary: true,
    })
  }

  // read/write your downloads
  if (
    summary.metadata.permissions.filesystems?.some(
      (x) => x.toLowerCase() === "xdg-download",
    ) ||
    summary.metadata.permissions.filesystems?.some(
      (x) => x.toLowerCase() === "xdg-download:rw",
    )
  ) {
    appSafetyRating.push({
      safetyRating: SafetyRating.potentially_unsafe,
      description: "can-read-write-your-downloads",
      icon: HiOutlineArrowDownTray,
      showOnSummary: true,
    })
  }

  // read your downloads
  if (
    summary.metadata.permissions.filesystems?.some(
      (x) => x.toLowerCase() === "xdg-download:ro",
    )
  ) {
    appSafetyRating.push({
      safetyRating: SafetyRating.potentially_unsafe,
      description: "can-read-your-downloads",
      icon: HiOutlineArrowDownTray,
      showOnSummary: true,
    })
  }

  //   can access some specific files
  if (
    summary.metadata.permissions.filesystems?.length > 0 &&
    !summary.metadata.permissions.filesystems?.some(
      (x) =>
        x.toLowerCase() === "home" ||
        x.toLowerCase() === "home:rw" ||
        x.toLowerCase() === "~" ||
        x.toLowerCase() === "~:rw" ||
        x.toLowerCase() === "host" ||
        x.toLowerCase() === "host:rw" ||
        x.toLowerCase() === "home:ro" ||
        x.toLowerCase() === "~:ro" ||
        x.toLowerCase() === "host:ro" ||
        x.toLowerCase() === "xdg-download" ||
        x.toLowerCase() === "xdg-download:rw" ||
        x.toLowerCase() === "xdg-download:ro" ||
        x.toLowerCase() === "xdg-config/kdeglobals:ro",
    )
  ) {
    appSafetyRating.push({
      safetyRating: SafetyRating.potentially_unsafe,
      description: "can-access-some-specific-files",
      icon: HiOutlineDocument,
      showOnSummary: true,
    })
  }

  if (appSafetyRating.length === 0) {
    appSafetyRating.push({
      safetyRating: SafetyRating.safe,
      description: "no-file-system-access",
      showOnSummary: false,
    })
  }

  return appSafetyRating
}
