import { FunctionComponent, useEffect, useState } from "react"
import Button from "./Button"
import { useTranslation } from "next-i18next"

interface Props {
  prompt: string
  entry?: string
  action: string
  onConfirmed: () => void
  onCancelled: () => void
}

/** A dialog to confirm an action and perform a callback function on
 * confirmation or cancellation.
 */
const ConfirmDialog: FunctionComponent<Props> = ({
  prompt,
  entry,
  action,
  onConfirmed,
  onCancelled,
}) => {
  const { t } = useTranslation()

  const [confirmed, setConfirmed] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [text, setText] = useState("")

  useEffect(() => {
    if (confirmed) onConfirmed()
  }, [onConfirmed, confirmed])

  useEffect(() => {
    if (cancelled) onCancelled()
  }, [onCancelled, cancelled])

  const toEnter = (
    <div>
      <p>{t("entry-confirmation-prompt", { text: entry })}</p>
      <input
        className="w-full rounded-xl border border-textSecondary p-3"
        value={text}
        onInput={(e) => setText((e.target as HTMLInputElement).value)}
      />
    </div>
  )

  const confirm = (
    <Button
      className="col-start-1"
      onClick={() => setConfirmed(true)}
      variant="primary"
    >
      {action}
    </Button>
  )

  return (
    <div className="fixed right-5 top-24 z-20 m-auto flex flex-col justify-center rounded-xl border border-textSecondary bg-bgColorPrimary p-3">
      <span>{prompt}</span>
      {entry ? toEnter : <></>}
      <div className="mt-3 grid grid-cols-2 gap-3">
        {entry && text === entry ? confirm : <></>}
        <Button
          className="col-start-2"
          onClick={() => setCancelled(true)}
          variant="primary"
        >
          {t("cancel")}
        </Button>
      </div>
    </div>
  )
}

export default ConfirmDialog
