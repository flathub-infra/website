import { Fragment, FunctionComponent, useEffect, useState } from "react"
import Button from "./Button"
import { useTranslation } from "next-i18next"
import { Dialog, Transition } from "@headlessui/react"

interface Props {
  isVisible: boolean
  prompt: string
  description?: string
  entry?: string
  action: string
  actionVariant?: "primary" | "secondary" | "destructive"
  onConfirmed: () => void
  onCancelled: () => void
}

/** A dialog to confirm an action and perform a callback function on
 * confirmation or cancellation.
 */
const ConfirmDialog: FunctionComponent<Props> = ({
  isVisible,
  prompt,
  description,
  entry,
  action,
  actionVariant,
  onConfirmed,
  onCancelled,
}) => {
  const { t } = useTranslation()

  const [text, setText] = useState("")

  const toEnter = (
    <div>
      <Dialog.Description>
        {t("entry-confirmation-prompt", { text: entry })}
      </Dialog.Description>
      <input
        className="w-full rounded-xl border border-flathub-sonic-silver p-3 dark:border-flathub-spanish-gray"
        value={text}
        onInput={(e) => setText((e.target as HTMLInputElement).value)}
      />
    </div>
  )

  return (
    <Transition appear show={isVisible} as={Fragment}>
      <Dialog as="div" className="z-20 " onClose={onCancelled}>
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="inline-flex flex-col justify-center space-y-6 rounded-xl bg-flathub-gainsborow p-14 shadow-md dark:bg-flathub-dark-gunmetal">
            <Dialog.Title className="m-0">{prompt}</Dialog.Title>

            {description && (
              <Dialog.Description>{description}</Dialog.Description>
            )}

            {entry ? toEnter : <></>}

            <div className="mt-3 grid grid-cols-2 gap-6">
              <Button
                className="col-start-1"
                onClick={onCancelled}
                variant="primary"
                aria-label={t("cancel")}
                title={t("cancel")}
              >
                {t("cancel")}
              </Button>
              <Button
                className="col-start-2"
                onClick={onConfirmed}
                variant={actionVariant ?? "primary"}
                aria-label={action}
                title={action}
                disabled={entry && text !== entry}
              >
                {action}
              </Button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </Transition>
  )
}

export default ConfirmDialog
