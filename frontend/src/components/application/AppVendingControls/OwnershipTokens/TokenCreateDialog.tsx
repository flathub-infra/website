import { Dialog, Transition } from "@headlessui/react"
import { useTranslation } from "next-i18next"
import { Fragment, FunctionComponent, useCallback, useState } from "react"
import { createVendingTokens } from "../../../../asyncs/vending"
import { Appstream } from "../../../../types/Appstream"
import Button from "../../../Button"

interface Props {
  app: Appstream
}

/**
 * The control elements to view and add/cancel ownership tokens for an app.
 */
const TokenCreateDialog: FunctionComponent<Props> = ({ app }) => {
  const { t } = useTranslation()

  const [shown, setShown] = useState(false)
  const [text, setText] = useState("")

  const textUpdate = useCallback((event) => setText(event.target.value), [])
  const onSubmit = useCallback(() => {
    setShown(false)

    // Strip leading and trailing whitespace characters
    const names = text.split(/\s*\n\s*/).filter((name) => name !== "")

    if (names.length > 0) {
      createVendingTokens(app.id, names)
    }
  }, [app.id, text])

  return (
    <>
      <Button onClick={() => setShown(true)}>Create tokens</Button>
      <Transition appear show={shown} as={Fragment}>
        <Dialog as="div" onClose={() => setShown(false)}>
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="inline-flex flex-col justify-center space-y-6 rounded-xl bg-bgColorPrimary p-14 shadow-md">
              <Dialog.Title className="m-0">Create tokens</Dialog.Title>
              <label>Token names</label>
              <textarea
                placeholder="Enter a list of names on separate lines, each will identify a new ownership token."
                value={text}
                onChange={textUpdate}
              />
              <Button onClick={onSubmit}>Submit</Button>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>
    </>
  )
}

export default TokenCreateDialog
