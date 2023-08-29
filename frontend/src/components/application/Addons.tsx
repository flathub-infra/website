import { FunctionComponent, useState } from "react"

import { AddonAppstream } from "../../types/Appstream"
import { useTranslation } from "next-i18next"
import { HiMiniInformationCircle } from "react-icons/hi2"
import {
  useFloating,
  useHover,
  useInteractions,
  offset,
  shift,
  autoPlacement,
  useRole,
  useDismiss,
  useFocus,
} from "@floating-ui/react-dom-interactions"
import clsx from "clsx"
import Modal from "../Modal"

interface Props {
  addons: AddonAppstream[]
}

const Addons: FunctionComponent<Props> = ({ addons }) => {
  const { t } = useTranslation()

  const [isModalOpen, setIsModalOpen] = useState(false)

  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const { x, y, reference, floating, strategy, context } = useFloating({
    open: isInfoOpen,
    onOpenChange: setIsInfoOpen,
    middleware: [shift(), autoPlacement(), offset(6)],
  })
  const hover = useHover(context, { move: false })
  const focus = useFocus(context)
  const dismiss = useDismiss(context)
  const role = useRole(context, { role: "tooltip" })

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ])

  return (
    <>
      {addons && addons.length > 0 && (
        <>
          <div className="flex gap-2 relative">
            <>
              <button
                ref={reference}
                {...getReferenceProps}
                className="absolute top-0 end-0 mt-1 me-1"
                aria-label={t("addon-install-info")}
              >
                <HiMiniInformationCircle
                  className="h-5 w-5"
                  aria-label={t("addon-install-info")}
                />
              </button>
              {isInfoOpen && (
                <div
                  ref={floating}
                  style={{
                    position: strategy,
                    top: y ?? 0,
                    left: x ?? 0,
                  }}
                  className={clsx(
                    "text-xs font-semibold",
                    "z-20 mx-1 max-w-sm rounded-xl p-4",
                    "border-1 border border-flathub-gray-x11 dark:border-flathub-sonic-silver",
                    "bg-flathub-white dark:bg-flathub-granite-gray dark:text-flathub-gainsborow",
                  )}
                  {...getFloatingProps()}
                >
                  {t("addon-install-info-text")}
                </div>
              )}
            </>
          </div>
          <div className="flex flex-col divide-y dark:divide-flathub-granite-gray">
            {addons.slice(0, 5).map((addon) => {
              return (
                <div className="flex flex-col px-4 py-3" key={addon.id}>
                  <div>
                    <h3 className="font-semibold">{addon.name}</h3>
                  </div>
                  <span
                    className={clsx(
                      "text-sm dark:text-flathub-spanish-gray leading-none text-flathub-granite-gray",
                    )}
                  >
                    {addon.summary}
                  </span>
                </div>
              )
            })}
            {addons.length > 5 ? (
              <button
                className="w-full rounded-bl-xl rounded-br-xl rounded-tl-none rounded-tr-none border-t px-0 py-3 font-semibold transition hover:cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 dark:border-zinc-600"
                onClick={() => setIsModalOpen(true)}
              >
                <span>{t("more")}</span>
              </button>
            ) : null}
          </div>
        </>
      )}
      <Modal
        shown={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t("add-ons")}
      >
        <div className="overflow-y-auto max-h-[70vh]">
          <div
            className={clsx(
              "dark:bg-flathub-arsenic border dark:border-none",
              "flex flex-col min-w-0 gap-5 rounded-xl bg-flathub-white duration-500",
            )}
          >
            <div className="flex flex-col divide-y dark:divide-flathub-granite-gray">
              {addons.map((addon) => {
                return (
                  <div className="flex flex-col px-4 py-3" key={addon.id}>
                    <div>
                      <h3 className="font-semibold">{addon.name}</h3>
                    </div>
                    <span
                      className={clsx(
                        "text-sm dark:text-flathub-spanish-gray leading-none text-flathub-granite-gray",
                      )}
                    >
                      {addon.summary}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Modal>
    </>
  )
}

export default Addons
