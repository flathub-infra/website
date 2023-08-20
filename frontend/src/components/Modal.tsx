import { Dialog, Transition } from "@headlessui/react"
import { Fragment, FunctionComponent } from "react"
import Button from "./Button"
import { useTranslation } from "react-i18next"
import { HiXMark } from "react-icons/hi2"
import clsx from "clsx"

interface Props {
  shown: boolean
  title: string
  centerTitle?: boolean
  description?: string
  onClose: () => void
  children?: React.ReactNode
  cancelButton?: {
    label?: string
    onClick: () => void
    disabled?: boolean
  }
  submitButton?: {
    label?: string
    onClick: () => void
    disabled?: boolean
  }
}

const Modal: FunctionComponent<Props> = ({
  shown,
  title,
  centerTitle,
  description,
  onClose,
  children,
  cancelButton,
  submitButton,
}) => {
  const { t } = useTranslation()

  return (
    <>
      <Transition.Root show={shown} as={Fragment}>
        <Dialog as="div" className="relative z-40" onClose={onClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div
              aria-hidden
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
            />
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
                <Dialog.Panel className="relative transform overflow-hidden rounded-xl bg-flathub-white px-4 pb-4 pt-5 text-left shadow-xl transition-all dark:bg-flathub-dark-gunmetal sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                  <div className="absolute end-0 top-0 hidden pe-6 pt-6 sm:block">
                    <button
                      type="button"
                      className="rounded-md bg-flathub-white text-flathub-spanish-gray hover:text-flathub-gray-x11 focus:outline-none focus:ring-2 focus:ring-flathub-celestial-blue
                       focus:ring-offset-2 dark:bg-flathub-dark-gunmetal dark:text-flathub-gainsborow hover:dark:text-flathub-spanish-gray"
                      onClick={() => onClose()}
                    >
                      <span className="sr-only">{t("close")}</span>
                      <HiXMark className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>

                  <Dialog.Title
                    as="h3"
                    className={clsx(
                      centerTitle && "text-center",
                      "text-lg font-semibold pb-5",
                    )}
                  >
                    {title}
                  </Dialog.Title>
                  {description && (
                    <Dialog.Description className="m-0 pb-4">
                      {description}
                    </Dialog.Description>
                  )}

                  {children}

                  <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    {submitButton && (
                      <Button
                        className="inline-flex w-full justify-center px-3 py-2 sm:ms-3 sm:w-auto"
                        onClick={submitButton.onClick}
                        variant="primary"
                        aria-label={submitButton.label ?? t("submit")}
                        disabled={submitButton.disabled}
                      >
                        {t(submitButton.label ?? t("submit"))}
                      </Button>
                    )}
                    {cancelButton && (
                      <Button
                        className="mt-3 inline-flex w-full justify-center px-3 py-2 sm:mt-0 sm:w-auto"
                        onClick={cancelButton.onClick}
                        variant="secondary"
                        aria-label={cancelButton.label ?? t("cancel")}
                        disabled={cancelButton.disabled}
                      >
                        {t(cancelButton.label ?? t("cancel"))}
                      </Button>
                    )}
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

export default Modal
