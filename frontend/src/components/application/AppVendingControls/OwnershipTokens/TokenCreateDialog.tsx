import { Dialog, Transition } from "@headlessui/react"
import { useTranslation } from "next-i18next"
import { Fragment, FunctionComponent, useCallback, useState } from "react"
import { createVendingTokens } from "../../../../asyncs/vending"
import { Appstream } from "../../../../types/Appstream"
import Button from "../../../Button"

interface Props {
  app: Appstream
  updateCallback: CallableFunction
}

/**
 * The button to open a model dialog where application ownership tokens can be generated.
 */
const TokenCreateDialog: FunctionComponent<Props> = ({
  app,
  updateCallback,
}) => {
  const { t } = useTranslation()

  const [shown, setShown] = useState(false)
  const [text, setText] = useState("")

  const textUpdate = useCallback((event) => setText(event.target.value), [])
  const onSubmit = useCallback(async () => {
    setShown(false)

    // Strip leading and trailing whitespace characters
    const names = text.split(/\s*\n\s*/).filter((name) => name !== "")

    if (names.length > 0) {
      await createVendingTokens(app.id, names)
      updateCallback()
      setText("")
    }
  }, [app.id, text, updateCallback])

  return (
    <>
      <Button onClick={() => setShown(true)}>{t("create-tokens")}</Button>
      <Transition appear show={shown} as={Fragment}>
        <Dialog
          as="div"
          onClose={() => {
            setShown(false)
            setText("")
          }}
        >
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="inline-flex flex-col justify-center space-y-6 rounded-xl bg-flathub-gainsborow p-14 shadow-md dark:bg-flathub-dark-gunmetal">
              <Dialog.Title className="m-0">{t("create-tokens")}</Dialog.Title>
              <textarea
                placeholder={t("token-creation-placeholder")}
                value={text}
                onChange={textUpdate}
                className="h-40 rounded-xl p-3"
              />
              <Button onClick={onSubmit}>{t("submit")}</Button>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>
    </>
  )
}

export default TokenCreateDialog
