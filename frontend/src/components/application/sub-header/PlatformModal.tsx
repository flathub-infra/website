import { useTranslations } from "next-intl"
import clsx from "clsx"
import {
  CircleHelp,
  Gamepad2,
  Hand,
  Keyboard,
  Monitor,
  Mouse,
  Smartphone,
} from "lucide-react"
import Modal from "../../Modal"
import { StackedListBox } from "../StackedListBox"
import { DesktopAppstream } from "src/codegen"
import {
  getControlRelation,
  getDisplaySupport,
  hasRequiredControls,
  isAdaptiveForDeclaredHardware,
} from "./platform-support"
import AdaptiveDevicesIcon from "./AdaptiveDevicesIcon"

type ControlRelation = "required" | "recommended" | "supported" | "unknown"

const controlInfo = [
  { value: "keyboard", label: "keyboard", plural: "keyboards", Icon: Keyboard },
  {
    value: "pointing",
    label: "mouse",
    plural: "pointing-devices",
    Icon: Mouse,
  },
  {
    value: "touch",
    label: "touchscreen",
    plural: "touchscreens",
    Icon: Hand,
  },
  { value: "gamepad", label: "gamepad", plural: "gamepads", Icon: Gamepad2 },
]

const PlatformModal = ({
  isOpen,
  onClose,
  appName,
  requires,
  recommends,
  supports,
}: {
  isOpen: boolean
  onClose: () => void
  appName: string
  requires?: DesktopAppstream["requires"]
  recommends?: DesktopAppstream["recommends"]
  supports?: DesktopAppstream["supports"]
}) => {
  const t = useTranslations()
  const adaptive = isAdaptiveForDeclaredHardware(requires, recommends, supports)
  const mobileSupport = getDisplaySupport(
    "mobile",
    requires,
    recommends,
    supports,
  )
  const desktopSupport = getDisplaySupport(
    "desktop",
    requires,
    recommends,
    supports,
  )
  const hasSpecificRequirements =
    hasRequiredControls(requires) ||
    mobileSupport === "required" ||
    desktopSupport === "required" ||
    mobileSupport === "unsupported" ||
    desktopSupport === "unsupported"
  const status = adaptive
    ? "adaptive"
    : hasSpecificRequirements
      ? "specific"
      : "unknown"

  const displayRow = (
    id: number,
    category: "mobile" | "desktop",
    support: ReturnType<typeof getDisplaySupport>,
  ) => {
    const isMobile = category === "mobile"
    const Icon =
      support === "unknown" ? CircleHelp : isMobile ? Smartphone : Monitor
    const descriptionKey = {
      required: isMobile ? "requires-small-screen" : "requires-large-screen",
      supported: isMobile
        ? "works-well-on-mobile"
        : "works-well-on-large-screens",
      unsupported: isMobile
        ? "mobile-display-not-supported"
        : "desktop-display-not-supported",
      unknown: isMobile
        ? "mobile-display-support-unknown"
        : "desktop-display-support-unknown",
    }[support]
    const headerKey = {
      required: `${category}-only`,
      supported: `${category}-support`,
      unsupported: `${category}-not-supported`,
      unknown: `${category}-support-unknown`,
    }[support]
    const colorClass = {
      required:
        "text-flathub-status-yellow bg-flathub-status-yellow/25 dark:bg-flathub-status-yellow-dark/25 dark:text-flathub-status-yellow-dark",
      supported:
        "text-flathub-status-green bg-flathub-status-green/25 dark:bg-flathub-status-green-dark/25 dark:text-flathub-status-green-dark",
      unsupported:
        "text-flathub-status-yellow bg-flathub-status-yellow/25 dark:bg-flathub-status-yellow-dark/25 dark:text-flathub-status-yellow-dark",
      unknown:
        "text-flathub-sonic-silver bg-flathub-gainsborow/40 dark:bg-flathub-dark-gunmetal dark:text-flathub-spanish-gray",
    }[support]

    return {
      id,
      header: t(`sub-header.${headerKey}`),
      description: t(`sub-header.${descriptionKey}`),
      icon: (
        <div className={clsx("h-10 w-10 rounded-full p-2", colorClass)}>
          <Icon className="h-full w-full" />
        </div>
      ),
    }
  }

  const deviceInfoItems = [
    ...controlInfo.flatMap(({ value, label, plural, Icon }, index) => {
      const relation = getControlRelation(value, requires, recommends, supports)
      if (value === "gamepad" && relation === "unknown") return []

      const colorClass = {
        required:
          "text-flathub-status-red bg-flathub-status-red/25 dark:bg-flathub-status-red-dark/25 dark:text-flathub-status-red-dark",
        recommended:
          "text-flathub-status-yellow bg-flathub-status-yellow/25 dark:bg-flathub-status-yellow-dark/25 dark:text-flathub-status-yellow-dark",
        supported:
          "text-flathub-status-green bg-flathub-status-green/25 dark:bg-flathub-status-green-dark/25 dark:text-flathub-status-green-dark",
        unknown:
          "text-flathub-sonic-silver bg-flathub-gainsborow/40 dark:bg-flathub-dark-gunmetal dark:text-flathub-spanish-gray",
      }[relation]

      return [
        {
          id: index,
          header: t(`sub-header.${label}-support`),
          description: t(`sub-header.control-${relation}`, {
            device: t(`sub-header.${plural}`),
          }),
          icon: (
            <div className={clsx("h-10 w-10 rounded-full p-2", colorClass)}>
              <Icon className="h-full w-full" />
            </div>
          ),
        },
      ]
    }),
  ]
  return (
    <Modal
      shown={isOpen}
      onClose={onClose}
      centerTitle
      aboveTitle={
        <div className="flex flex-col items-center pb-2">
          {status === "adaptive" ? (
            <AdaptiveDevicesIcon adaptive className="h-16 px-5" />
          ) : status === "specific" ? (
            <div className="h-16 w-16 rounded-full bg-flathub-status-yellow/25 p-3 text-flathub-status-yellow dark:bg-flathub-status-yellow-dark/25 dark:text-flathub-status-yellow-dark">
              <CircleHelp className="w-full h-full" />
            </div>
          ) : (
            <div className="h-16 w-16 rounded-full bg-flathub-gainsborow/40 p-3 text-flathub-sonic-silver dark:bg-flathub-dark-gunmetal dark:text-flathub-spanish-gray">
              <CircleHelp className="w-full h-full" />
            </div>
          )}
        </div>
      }
      title={
        status === "adaptive"
          ? t("sub-header.adaptive")
          : status === "specific"
            ? t("sub-header.appname-works-best-on-specific-hardware", {
                appName,
              })
            : t("sub-header.appname-hardware-support", { appName })
      }
      description={
        status === "adaptive" ? t("sub-header.adaptive-description") : undefined
      }
      size="xl"
      className="sm:max-w-[640px]"
    >
      <StackedListBox
        items={[
          displayRow(0, "mobile", mobileSupport),
          displayRow(1, "desktop", desktopSupport),
          ...deviceInfoItems.map((item, index) => ({
            ...item,
            id: index + 2,
          })),
        ]}
      />
    </Modal>
  )
}

export default PlatformModal
