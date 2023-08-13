import { Dialog, Transition } from "@headlessui/react"
import clsx from "clsx"
import { useTranslation } from "next-i18next"
import { Fragment, FunctionComponent, createElement, useState } from "react"
import { HiXMark } from "react-icons/hi2"
import {
  getSafetyRating,
  safetyRatingToColor,
  safetyRatingToIcon,
  safetyRatingToTranslationKey,
} from "src/safety"
import { Appstream } from "src/types/Appstream"
import { Summary } from "src/types/Summary"
import { StackedListBox } from "./StackedListBox"
import { IconType } from "react-icons"

interface Props {
  data: Appstream
  summary: Summary
}

const SafetyRatingIcon = ({
  highestSafetyRating,
  size,
  icon,
}: {
  highestSafetyRating: number
  size: "small" | "large"
  icon?: IconType
}) => {
  return (
    <div
      className={clsx(
        size === "small" ? "h-10 w-10" : "h-14 w-14",
        "rounded-full p-2",
        safetyRatingToColor(highestSafetyRating),
      )}
    >
      {icon
        ? createElement(icon, {
            className: "w-full h-full",
          })
        : safetyRatingToIcon(highestSafetyRating)}
    </div>
  )
}

const SafetyRating: FunctionComponent<Props> = ({ data, summary }) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  const safetyRating = getSafetyRating(data, summary)

  const highestSafetyRating = Math.max(
    ...Object.values(safetyRating).map((x) => x.safetyRating),
  )

  return (
    <>
      <button
        className="flex w-full flex-col items-center gap-1 rounded-xl p-4 duration-500 hover:bg-flathub-gainsborow/20 hover:shadow-xl active:bg-flathub-gainsborow/40 active:shadow-sm hover:dark:bg-flathub-dark-gunmetal/20 active:dark:bg-flathub-arsenic"
        onClick={() => setIsOpen(true)}
      >
        <SafetyRatingIcon
          highestSafetyRating={highestSafetyRating}
          size="small"
        />
        <div className="text-lg font-bold">
          {t(safetyRatingToTranslationKey(highestSafetyRating))}
        </div>
        <div className="text-center">
          {safetyRating
            .filter((x) => x.safetyRating === highestSafetyRating)
            .filter((x) => x.showOnSummary)
            .map((x) => t(x.description))
            .join("; ")}
        </div>
      </button>

      <Transition.Root show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-40" onClose={setIsOpen}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-flathub-white px-4 pb-4 pt-5 text-left shadow-xl transition-all dark:bg-flathub-dark-gunmetal sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                  <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                    <button
                      type="button"
                      className="rounded-md bg-flathub-white text-flathub-spanish-gray hover:text-flathub-gray-x11 focus:outline-none focus:ring-2 focus:ring-flathub-celestial-blue
                       focus:ring-offset-2 dark:bg-flathub-dark-gunmetal dark:text-flathub-gainsborow hover:dark:text-flathub-spanish-gray"
                      onClick={() => setIsOpen(false)}
                    >
                      <span className="sr-only">Close</span>
                      <HiXMark className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <SafetyRatingIcon
                      highestSafetyRating={highestSafetyRating}
                      size="large"
                    />
                    <Dialog.Title
                      as="h3"
                      className="text-center text-base font-semibold leading-6"
                    >
                      {t(`appname-is-safety-rating-${highestSafetyRating}`, {
                        appName: data.name,
                      })}
                    </Dialog.Title>
                    <div className="mt-2 w-full">
                      <StackedListBox
                        items={safetyRating
                          .sort((a, b) => b.safetyRating - a.safetyRating)
                          .map(({ description, safetyRating, icon }, i) => ({
                            id: i,
                            header: t(description),
                            icon: (
                              <SafetyRatingIcon
                                highestSafetyRating={safetyRating}
                                size="small"
                                icon={icon}
                              />
                            ),
                          }))}
                      />
                      <ul></ul>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </>
  )
}

export default SafetyRating
