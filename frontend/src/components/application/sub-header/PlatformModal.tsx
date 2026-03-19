import { useTranslations } from "next-intl"
import clsx from "clsx"
import { Monitor, Smartphone, TriangleAlertIcon } from "lucide-react"
import Modal from "../../Modal"
import { StackedListBox } from "../StackedListBox"

const PlatformModal = ({
  isOpen,
  onClose,
  appName,
  isMobileFriendly,
}: {
  isOpen: boolean
  onClose: () => void
  appName: string
  isMobileFriendly: boolean
}) => {
  const t = useTranslations()

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
              isMobileFriendly
                ? "text-flathub-status-green bg-flathub-status-green/25 dark:bg-flathub-status-green-dark/25 dark:text-flathub-status-green-dark"
                : "text-flathub-status-yellow bg-flathub-status-yellow/25 dark:bg-flathub-status-yellow-dark/25 dark:text-flathub-status-yellow-dark",
            )}
          >
            {isMobileFriendly ? (
              <Smartphone className="w-full h-full" />
            ) : (
              <TriangleAlertIcon className="w-full h-full" />
            )}
          </div>
        </div>
      }
      title={
        isMobileFriendly
          ? t("sub-header.appname-works-on-all-devices", { appName })
          : t("sub-header.appname-works-best-on-specific-hardware", { appName })
      }
      size="sm"
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
        ]}
      />
    </Modal>
  )
}

export default PlatformModal
