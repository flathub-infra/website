import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react"
import { HiMiniXMark } from "react-icons/hi2"
import clsx from "clsx"
import { useTranslations } from "next-intl"

export default function SlideOver({ shown, onClose, title, children }) {
  const t = useTranslations()

  return (
    <Transition show={shown}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <div className="fixed inset-0" />

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 end-0 flex max-w-full ps-10">
              <TransitionChild
                enter="transform transition ease-in-out duration-500 sm:duration-700"
                enterFrom="translate-x-full rtl:translate-x-[-100%]"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-500 sm:duration-700"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full rtl:translate-x-[-100%]"
              >
                <DialogPanel className="pointer-events-auto w-screen max-w-2xl">
                  <div className="relative flex h-full flex-col overflow-y-scroll bg-flathub-lotion dark:bg-flathub-dark-gunmetal py-6 shadow-xl">
                    <div className="px-4 sm:px-6">
                      <div className="flex items-start justify-between">
                        <DialogTitle className="text-base font-semibold leading-6">
                          {title}
                        </DialogTitle>
                        <div className="absolute end-0 top-0 pe-4 pt-6 block">
                          <button
                            type="button"
                            className={clsx(
                              "size-7 flex justify-center items-center",
                              "transition",
                              "rounded-full",
                              "bg-flathub-gainsborow hover:bg-flathub-gray-x11",
                              "focus:outline-hidden focus:ring-2 focus:ring-flathub-celestial-blue",
                              "dark:hover:bg-flathub-sonic-silver dark:bg-flathub-granite-gray",
                            )}
                            onClick={() => onClose()}
                          >
                            <span className="sr-only">{t("close")}</span>
                            <HiMiniXMark
                              className="size-5"
                              aria-hidden="true"
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="relative mt-6 flex-1 px-4 sm:px-6">
                      {children}
                    </div>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
