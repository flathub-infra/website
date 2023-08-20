import { Dialog, Transition } from "@headlessui/react"
import { Fragment, FunctionComponent } from "react"
import Button from "./Button"
import { useTranslation } from "react-i18next"

interface Props {
  shown: boolean
  submitButtonText: string
  isSubmitButtonDisabled?: boolean
  onSubmit: () => void
  cancelButtonText?: string
  onCancel: () => void
  title: string
  description: string
  children?: React.ReactNode
}

const Modal: FunctionComponent<Props> = ({
  shown,
  submitButtonText,
  isSubmitButtonDisabled,
  onSubmit,
  cancelButtonText = "cancel",
  onCancel,
  title,
  description,
  children,
}) => {
  const { t } = useTranslation()

  return (
    <>
      <Transition appear show={shown} as={Fragment}>
        <Dialog
          as="div"
          onClose={() => {
            onCancel()
          }}
        >
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="inline-flex flex-col justify-center space-y-6 rounded-xl bg-flathub-gainsborow p-14 shadow-md dark:bg-flathub-dark-gunmetal">
              <Dialog.Title className="m-0">{title}</Dialog.Title>
              <Dialog.Description className="m-0">
                {description}
              </Dialog.Description>

              {children}

              <div className="mt-3 grid grid-cols-2 gap-6">
                <Button
                  className="col-start-1"
                  onClick={onCancel}
                  variant="secondary"
                  aria-label={t("cancel")}
                >
                  {t(cancelButtonText)}
                </Button>
                <Button
                  className="col-start-2"
                  onClick={onSubmit}
                  variant="primary"
                  aria-label={submitButtonText}
                  disabled={isSubmitButtonDisabled}
                >
                  {t(submitButtonText)}
                </Button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>
    </>
  )
}

export default Modal
