import {
  Description,
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react"
import { FunctionComponent, useRef } from "react"
import { useTranslations } from "next-intl"
import { XMarkIcon } from "@heroicons/react/20/solid"
import clsx from "clsx"
import { Button } from "@/components/ui/button"

interface Props {
  shown: boolean
  title: string
  centerTitle?: boolean
  description?: string
  onClose: () => void
  children?: React.ReactNode
  aboveTitle?: React.ReactNode
  cancelButton?: {
    label?: string
    onClick: () => void
    disabled?: boolean
  }
  submitButton?: {
    label?: string
    onClick: () => void
    disabled?: boolean
    variant?: "default" | "secondary" | "destructive"
  }
}

const Modal: FunctionComponent<Props> = ({
  shown,
  title,
  centerTitle,
  description,
  onClose,
  children,
  aboveTitle,
  cancelButton,
  submitButton,
}) => {
  const t = useTranslations()
  const ref = useRef(null)

  return (
    <>
      <Transition show={shown}>
        <Dialog
          as="div"
          className="relative z-40"
          onClose={onClose}
          initialFocus={ref}
        >
          <TransitionChild
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div
              aria-hidden
              className="fixed inset-0 bg-gray-500/75 transition-opacity"
            />
          </TransitionChild>

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <TransitionChild
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <DialogPanel className="relative transform w-full overflow-hidden rounded-xl bg-flathub-white px-4 pb-4 pt-5 text-start shadow-xl transition-all dark:bg-flathub-dark-gunmetal sm:my-8 sm:w-full sm:max-w-xl sm:p-6">
                  <div className="absolute end-0 top-0 pe-6 pt-6">
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
                      <XMarkIcon className="size-5" aria-hidden="true" />
                    </button>
                  </div>

                  {aboveTitle}

                  <DialogTitle
                    as="h3"
                    ref={ref}
                    className={clsx(
                      centerTitle && "text-center ps-8",
                      "text-lg font-semibold pb-5 pe-8",
                    )}
                  >
                    {title}
                  </DialogTitle>
                  {description && (
                    <Description className="m-0 pb-4">
                      {description}
                    </Description>
                  )}

                  {children}

                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                    {submitButton && (
                      <Button
                        size="lg"
                        className="w-full px-3 py-2 sm:ms-3 sm:w-auto"
                        onClick={submitButton.onClick}
                        variant={submitButton.variant ?? "default"}
                        aria-label={submitButton.label ?? t("submit")}
                        disabled={submitButton.disabled}
                      >
                        {submitButton.label ?? t("submit")}
                      </Button>
                    )}
                    {cancelButton && (
                      <Button
                        size="lg"
                        className="mt-3 w-full px-3 py-2 sm:mt-0 sm:w-auto"
                        onClick={cancelButton.onClick}
                        variant="secondary"
                        aria-label={cancelButton.label ?? t("cancel")}
                        disabled={cancelButton.disabled}
                      >
                        {cancelButton.label ?? t("cancel")}
                      </Button>
                    )}
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  )
}

export default Modal
