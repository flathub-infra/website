import { useTranslations } from "next-intl"
import clsx from "clsx"
import {
  Cpu,
  Gamepad2,
  Hand,
  Keyboard,
  Monitor,
  Mouse,
  Smartphone,
  TriangleAlertIcon,
} from "lucide-react"
import Modal from "../../Modal"
import { StackedListBox } from "../StackedListBox"
import { DesktopAppstream } from "src/codegen"

type AppstreamCondition = NonNullable<DesktopAppstream["requires"]>[number]
type ControlRelation = "required" | "recommended" | "supported" | "unknown"

const compareSymbols: Record<string, string> = {
  eq: "=",
  ne: "≠",
  ge: "≥",
  gt: ">",
  le: "≤",
  lt: "<",
}

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

const conditionLabels: Record<string, string> = {
  display_length: "display-size",
  memory: "memory",
}

const getConditionItems = (
  conditions: AppstreamCondition[] | null | undefined,
  relation: Exclude<ControlRelation, "unknown">,
  t: ReturnType<typeof useTranslations>,
) =>
  (conditions ?? [])
    .filter((condition) => condition.type !== "control")
    .map((condition, index) => {
      const value = condition.value ?? ""
      const Icon = condition.type === "memory" ? Cpu : Monitor
      const typeLabel =
        conditionLabels[condition.type] ?? condition.type.replaceAll("_", " ")
      const compare = compareSymbols[condition.compare ?? ""]
      const details = [compare, value].filter(Boolean).join(" ")

      return {
        id: index,
        header: t("sub-header.appstream-requirement", {
          requirement: conditionLabels[condition.type]
            ? t(`sub-header.${typeLabel}`)
            : typeLabel,
        }),
        description: t("sub-header.device-condition", {
          device: details,
          relation: t(`sub-header.${relation}`),
        }),
        icon: (
          <div
            className={clsx(
              "h-10 w-10 rounded-full p-2",
              relation === "required"
                ? "text-flathub-status-red bg-flathub-status-red/25 dark:bg-flathub-status-red-dark/25 dark:text-flathub-status-red-dark"
                : relation === "supported"
                  ? "text-flathub-status-green bg-flathub-status-green/25 dark:bg-flathub-status-green-dark/25 dark:text-flathub-status-green-dark"
                  : "text-flathub-status-yellow bg-flathub-status-yellow/25 dark:bg-flathub-status-yellow-dark/25 dark:text-flathub-status-yellow-dark",
            )}
          >
            <Icon className="h-full w-full" />
          </div>
        ),
      }
    })

const getControlRelation = (
  value: string,
  requires: AppstreamCondition[] | null | undefined,
  recommends: AppstreamCondition[] | null | undefined,
  supports: AppstreamCondition[] | null | undefined,
): ControlRelation => {
  const includesControl = (
    conditions: AppstreamCondition[] | null | undefined,
  ) =>
    conditions?.some(
      (condition) => condition.type === "control" && condition.value === value,
    )

  if (includesControl(requires)) return "required"
  if (includesControl(recommends)) return "recommended"
  if (includesControl(supports)) return "supported"
  return "unknown"
}

const PlatformModal = ({
  isOpen,
  onClose,
  appName,
  isMobileFriendly,
  requires,
  recommends,
  supports,
}: {
  isOpen: boolean
  onClose: () => void
  appName: string
  isMobileFriendly: boolean
  requires?: DesktopAppstream["requires"]
  recommends?: DesktopAppstream["recommends"]
  supports?: DesktopAppstream["supports"]
}) => {
  const t = useTranslations()
  const deviceInfoItems = [
    ...controlInfo.map(({ value, label, plural, Icon }, index) => {
      const relation = getControlRelation(value, requires, recommends, supports)
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

      return {
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
      }
    }),
    ...getConditionItems(requires, "required", t),
    ...getConditionItems(recommends, "recommended", t),
    ...getConditionItems(supports, "supported", t),
  ]
  const hasRequiredControls = requires?.some(
    (condition) => condition.type === "control",
  )
  const worksOnMostDevices = isMobileFriendly && !hasRequiredControls

  return (
    <Modal
      shown={isOpen}
      onClose={onClose}
      centerTitle
      aboveTitle={
        <div className="flex flex-col items-center pb-2">
          <div
            className={clsx(
              "h-16 w-16 rounded-full p-3",
              worksOnMostDevices
                ? "text-flathub-status-green bg-flathub-status-green/25 dark:bg-flathub-status-green-dark/25 dark:text-flathub-status-green-dark"
                : "text-flathub-status-yellow bg-flathub-status-yellow/25 dark:bg-flathub-status-yellow-dark/25 dark:text-flathub-status-yellow-dark",
            )}
          >
            {worksOnMostDevices ? (
              <Smartphone className="w-full h-full" />
            ) : (
              <TriangleAlertIcon className="w-full h-full" />
            )}
          </div>
        </div>
      }
      title={
        worksOnMostDevices
          ? t("sub-header.appname-works-on-most-devices", { appName })
          : t("sub-header.appname-works-best-on-specific-hardware", { appName })
      }
      size="xl"
    >
      <StackedListBox
        items={[
          {
            id: 0,
            header: t("sub-header.mobile-support"),
            description: isMobileFriendly
              ? t("sub-header.works-well-on-mobile")
              : t("sub-header.may-not-work-well-on-mobile"),
            icon: (
              <div
                className={clsx(
                  "h-10 w-10 rounded-full p-2",
                  isMobileFriendly
                    ? "text-flathub-status-green bg-flathub-status-green/25 dark:bg-flathub-status-green-dark/25 dark:text-flathub-status-green-dark"
                    : "text-flathub-sonic-silver bg-flathub-gainsborow/40 dark:bg-flathub-dark-gunmetal dark:text-flathub-spanish-gray",
                )}
              >
                <Smartphone className="w-full h-full" />
              </div>
            ),
          },
          {
            id: 1,
            header: t("sub-header.desktop-support"),
            description: t("sub-header.works-well-on-large-screens"),
            icon: (
              <div className="h-10 w-10 rounded-full p-2 text-flathub-status-green bg-flathub-status-green/25 dark:bg-flathub-status-green-dark/25 dark:text-flathub-status-green-dark">
                <Monitor className="w-full h-full" />
              </div>
            ),
          },
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
