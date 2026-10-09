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
  type PlatformSupportStatus,
} from "./platform-support"
import PlatformSupportSummary from "./PlatformSupportSummary"

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
  status,
  requires,
  recommends,
  supports,
}: {
  isOpen: boolean
  onClose: () => void
  appName: string
  status: PlatformSupportStatus
  requires?: DesktopAppstream["requires"]
  recommends?: DesktopAppstream["recommends"]
  supports?: DesktopAppstream["supports"]
}) => {
  const t = useTranslations()
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
  const displayRow = (
    id: number,
    category: "mobile" | "desktop",
    support: ReturnType<typeof getDisplaySupport>,
  ) => {
    const isMobile = category === "mobile"
    const Icon =
      support === "unknown" ? CircleHelp : isMobile ? Smartphone : Monitor
    const descriptionKey = {
      required: isMobile
        ? "works-well-on-mobile"
        : "works-well-on-large-screens",
      supported: isMobile
        ? "works-well-on-mobile"
        : "works-well-on-large-screens",
      unsupported: isMobile
        ? "may-not-work-well-on-mobile"
        : "may-not-work-well-on-large-screens",
      unknown: isMobile
        ? "mobile-display-support-unknown"
        : "desktop-display-support-unknown",
    }[support]
    const headerKey = {
      required: `${category}-support`,
      supported: `${category}-support`,
      unsupported: `${category}-support`,
      unknown: `${category}-support-unknown`,
    }[support]
    const colorClass = {
      required:
        "text-flathub-status-green bg-flathub-status-green/25 dark:bg-flathub-status-green-dark/25 dark:text-flathub-status-green-dark",
      supported:
        "text-flathub-status-green bg-flathub-status-green/25 dark:bg-flathub-status-green-dark/25 dark:text-flathub-status-green-dark",
      unsupported:
        "text-flathub-sonic-silver bg-flathub-gainsborow/40 dark:bg-flathub-dark-gunmetal dark:text-flathub-spanish-gray",
      unknown:
        "text-flathub-sonic-silver bg-flathub-gainsborow/40 dark:bg-flathub-dark-gunmetal dark:text-flathub-spanish-gray",
    }[support]

    return {
      id,
      header: t(`platform-support.${headerKey}`),
      description: t(`platform-support.${descriptionKey}`),
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
          header: t(`platform-support.${label}-support`),
          description: t(`platform-support.control-${relation}`, {
            device: t(`platform-support.${plural}`),
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
      title={
        <PlatformSupportSummary
          status={status}
          appName={appName}
          variant="modal"
        />
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
