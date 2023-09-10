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
  HiOutlineWrenchScrewdriver,
  HiOutlineCog6Tooth,
} from "react-icons/hi2"
import { Appstream } from "./types/Appstream"
import { Summary, Permissions } from "./types/Summary"
import React from "react"
import { IconType } from "react-icons"
import { BsWifiOff } from "react-icons/bs"

enum SafetyRating {
  safe = 1,
  probably_safe = 2,
  potentially_unsafe = 3,
  unsafe = 4,
}

interface AppSafetyRating {
  safetyRating: SafetyRating
  title: string
  titleOptions?: { folder: string }
  description: string
  descriptionOptions?: { folder: string }
  icon?: IconType
  showOnSummaryOrDetails: "summary" | "details" | "both"
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
      title: "network-access",
      description: "has-network-access",
      icon: HiOutlineWifi,
      showOnSummaryOrDetails: "both",
    })
  } else {
    appSafetyRating.push({
      safetyRating: SafetyRating.safe,
      title: "no-network-access",
      description: "cannot-access-the-internet",
      icon: BsWifiOff,
      showOnSummaryOrDetails: "details",
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
      icon: HiOutlineCog6Tooth,
      title: "uses-system-services",
      description: "can-request-data-from-system-services",
      showOnSummaryOrDetails: "both",
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
      icon: HiOutlineCog6Tooth,
      title: "uses-session-services",
      description: "can-request-data-from-session-services",
      showOnSummaryOrDetails: "both",
    })
  }

  // devices
  if (
    summary.metadata.permissions.devices?.some((x) => x.toLowerCase() === "all")
  ) {
    appSafetyRating.push({
      safetyRating: SafetyRating.potentially_unsafe,
      title: "user-device-access",
      description: "can-access-hardware-devices",
      icon: HiOutlineVideoCamera,
      showOnSummaryOrDetails: "both",
    })
  } else {
    appSafetyRating.push({
      safetyRating: SafetyRating.safe,
      title: "no-user-device-access",
      description: "no-user-device-access-description",
      icon: HiOutlineVideoCameraSlash,
      showOnSummaryOrDetails: "details",
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
      title: "system-device-access",
      description: "can-access-system-devices",
      icon: HiOutlineCpuChip,
      showOnSummaryOrDetails: "both",
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
      icon: HiOutlineWrenchScrewdriver,
      title: "user-settings",
      description: "can-access-and-change-user-settings",
      showOnSummaryOrDetails: "both",
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
      title: "legacy-windowing-system",
      description: "legacy-windowing-system-description",
      icon: HiOutlineComputerDesktop,
      showOnSummaryOrDetails: "both",
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
      title: "arbitrary-permissions",
      description: "can-acquire-arbitrary-permissions",
      showOnSummaryOrDetails: "both",
    })
  }

  if (
    appSafetyRating.filter((x) => x.safetyRating === SafetyRating.safe)
      .length === appSafetyRating.length
  ) {
    appSafetyRating.push({
      safetyRating: SafetyRating.safe,
      title: "no-permissions",
      description: "no-permissions-description",
      showOnSummaryOrDetails: "both",
    })
  }

  if (summary.metadata.runtimeIsEol) {
    appSafetyRating.push({
      safetyRating: SafetyRating.potentially_unsafe,
      title: "uses-eol-runtime",
      description: "uses-eol-runtime-description",
      icon: HiOutlineExclamationTriangle,
      showOnSummaryOrDetails: "both",
    })
  }

  if (!appstream.project_license || !appstream.is_free_license) {
    appSafetyRating.push({
      safetyRating: SafetyRating.probably_safe,
      title: "proprietary-code",
      description: "proprietary-code-description",
      icon: HiOutlineExclamationTriangle,
      showOnSummaryOrDetails: "both",
    })
  } else {
    appSafetyRating.push({
      safetyRating: SafetyRating.safe,
      title: "auditable-code",
      description: "auditable-code-description",
      icon: HiOutlineCheckCircle,
      showOnSummaryOrDetails: "both",
    })
  }

  if (
    appstream.metadata &&
    appstream.metadata["flathub::verification::verified"] === "true"
  ) {
    appSafetyRating.push({
      safetyRating: SafetyRating.safe,
      title: "software-developer-verified",
      description: "software-developer-verified-description",
      icon: HiOutlineCheckBadge,
      showOnSummaryOrDetails: "both",
    })
  }

  return appSafetyRating
}
function addFileSafetyRatings(summary: Summary): AppSafetyRating[] {
  // Implements https://gitlab.gnome.org/GNOME/gnome-software/-/blob/9ae6d604297cd946ab45c11f7d6c25461cb119c9/plugins/flatpak/gs-flatpak.c#L319
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
      title: "home-folder-read-write-access",
      description: "can-read-write-home-folder",
      icon: HiOutlineDocument,
      showOnSummaryOrDetails: "both",
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
      title: "full-file-system-read-access",
      description: "can-read-all-data-on-file-system",
      icon: HiOutlineDocument,
      showOnSummaryOrDetails: "both",
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
      title: "download-folder-read-write-access",
      description: "can-read-write-your-downloads",
      icon: HiOutlineArrowDownTray,
      showOnSummaryOrDetails: "both",
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
      title: "download-folder-read-access",
      description: "can-read-all-data-in-your-download-folder",
      icon: HiOutlineArrowDownTray,
      showOnSummaryOrDetails: "both",
    })
  }

  //   can access some specific files
  specificFileHandling(summary.metadata.permissions, appSafetyRating)

  if (appSafetyRating.length === 0) {
    appSafetyRating.push({
      safetyRating: SafetyRating.safe,
      title: "no-file-system-access",
      description: "no-file-system-access-description",
      showOnSummaryOrDetails: "details",
    })
  }

  return appSafetyRating
}

function specificFileHandling(
  permissions: Permissions,
  appSafetyRating: AppSafetyRating[],
) {
  // Implements https://gitlab.gnome.org/GNOME/gnome-software/-/blob/9ae6d604297cd946ab45c11f7d6c25461cb119c9/plugins/flatpak/gs-flatpak.c#L319
  const fileSystemsOther = [
    { folder: "/", fullMatchKey: null, partialMatchKey: "system-folder-x" },
    {
      folder: "home/",
      fullMatchKey: null,
      partialMatchKey: "home-subfolder-x",
    },
    {
      folder: "~/",
      fullMatchKey: null,
      partialMatchKey: "home-subfolder-x",
    },
    {
      folder: "host-os",
      fullMatchKey: "host-system-folders",
      partialMatchKey: null,
    },
    {
      folder: "host-etc",
      fullMatchKey: "host-system-configuration-from-etc",
      partialMatchKey: null,
    },
    {
      folder: "xdg-desktop",
      fullMatchKey: "desktop-folder",
      partialMatchKey: "desktop-subfolder-x",
    },
    {
      folder: "xdg-documents",
      fullMatchKey: "documents-folder",
      partialMatchKey: "documents-subfolder-x",
    },
    {
      folder: "xdg-music",
      fullMatchKey: "music-folder",
      partialMatchKey: "music-subfolder-x",
    },
    {
      folder: "xdg-pictures",
      fullMatchKey: "pictures-folder",
      partialMatchKey: "pictures-subfolder-x",
    },
    {
      folder: "xdg-public-share",
      fullMatchKey: "public-share-folder",
      partialMatchKey: "public-share-subfolder-x",
    },
    {
      folder: "xdg-videos",
      fullMatchKey: "videos-folder",
      partialMatchKey: "videos-subfolder-x",
    },
    {
      folder: "xdg-templates",
      fullMatchKey: "templates-folder",
      partialMatchKey: "templates-subfolder-x",
    },
    {
      folder: "xdg-cache",
      fullMatchKey: "user-cache-folder",
      partialMatchKey: "user-cache-subfolder-x",
    },
    {
      folder: "xdg-config",
      fullMatchKey: "user-configuration-folder",
      partialMatchKey: "user-configuration-subfolder-x",
    },
    {
      folder: "xdg-data",
      fullMatchKey: "user-data-folder",
      partialMatchKey: "user-data-subfolder-x",
    },
    {
      folder: "xdg-run",
      fullMatchKey: "user-runtime-folder",
      partialMatchKey: "user-runtime-subfolder-x",
    },
  ]

  const prefilteredPermissions = permissions.filesystems?.filter(
    (x) =>
      x.toLowerCase() !== "home" &&
      x.toLowerCase() !== "home:rw" &&
      x.toLowerCase() !== "~" &&
      x.toLowerCase() !== "~:rw" &&
      x.toLowerCase() !== "host" &&
      x.toLowerCase() !== "host:rw" &&
      x.toLowerCase() !== "home:ro" &&
      x.toLowerCase() !== "~:ro" &&
      x.toLowerCase() !== "host:ro" &&
      x.toLowerCase() !== "xdg-download" &&
      x.toLowerCase() !== "xdg-download:rw" &&
      x.toLowerCase() !== "xdg-download:ro" &&
      x.toLowerCase() !== "xdg-config/kdeglobals:ro",
  )

  if (prefilteredPermissions?.length > 0) {
    let nonMatchedPermissions = prefilteredPermissions

    fileSystemsOther.forEach((fileSystem) => {
      const fullMatch = nonMatchedPermissions.filter(
        (x) => x.toLowerCase() === fileSystem.folder.toLowerCase(),
      )
      if (fullMatch.length > 0 && fileSystem.fullMatchKey) {
        fullMatch.forEach((x) => {
          appSafetyRating.push({
            safetyRating: SafetyRating.potentially_unsafe,
            title: fileSystem.fullMatchKey,
            description: readWriteTranslationKey(x),
            icon: HiOutlineDocument,
            showOnSummaryOrDetails: "details",
          })
        })
        nonMatchedPermissions = nonMatchedPermissions.filter(
          (x) => x.toLowerCase() !== fileSystem.folder.toLowerCase(),
        )
      }

      const partialMatch = nonMatchedPermissions.filter((x) =>
        x.toLowerCase().startsWith(fileSystem.folder.toLowerCase()),
      )
      if (partialMatch.length > 0 && fileSystem.partialMatchKey) {
        partialMatch.forEach((x) => {
          appSafetyRating.push({
            safetyRating: SafetyRating.potentially_unsafe,
            title: fileSystem.partialMatchKey,
            titleOptions: { folder: trimPermission(x) },
            description: readWriteTranslationKey(x),
            icon: HiOutlineDocument,
            showOnSummaryOrDetails: "details",
          })
        })
        nonMatchedPermissions = nonMatchedPermissions.filter(
          (x) => !x.toLowerCase().startsWith(fileSystem.folder.toLowerCase()),
        )
      }
    })

    appSafetyRating.push({
      safetyRating: SafetyRating.potentially_unsafe,
      title: "can-access-some-specific-files",
      description: "",
      icon: HiOutlineDocument,
      showOnSummaryOrDetails: "summary",
    })
  }
}

function readWriteTranslationKey(filesystemPermission: string): string {
  if (isReadOnly(filesystemPermission)) {
    return "can-read-all-data"
  } else if (isReadWrite(filesystemPermission)) {
    return "can-read-write-all-data"
  } else if (isCreate(filesystemPermission)) {
    return "can-create-files"
  } else {
    return "can-read-write-all-data"
  }
}

function isReadOnly(filesystemPermission: string): boolean {
  return filesystemPermission.endsWith(":ro")
}

function isReadWrite(filesystemPermission: string): boolean {
  return filesystemPermission.endsWith(":rw")
}

function isCreate(filesystemPermission: string): boolean {
  return filesystemPermission.endsWith(":create")
}

function trimPermission(filesystemPermission: string): string {
  const startIndex = filesystemPermission.indexOf("/") + 1

  if (isReadOnly(filesystemPermission)) {
    return filesystemPermission.substring(
      startIndex,
      filesystemPermission.length - 3,
    )
  } else if (isReadWrite(filesystemPermission)) {
    return filesystemPermission.substring(
      startIndex,
      filesystemPermission.length - 3,
    )
  } else if (isCreate(filesystemPermission)) {
    return filesystemPermission.substring(
      startIndex,
      filesystemPermission.length - 7,
    )
  } else {
    return filesystemPermission.substring(startIndex)
  }
}
