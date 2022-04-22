import { FunctionComponent, useEffect, useState } from 'react'
import Button from './Button'
import styles from './ConfirmDialog.module.scss'

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
  const [confirmed, setConfirmed] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const [text, setText] = useState('')

  useEffect(() => {
    if (confirmed) onConfirmed()
  }, [onConfirmed, confirmed])

  useEffect(() => {
    if (cancelled) onCancelled()
  }, [onCancelled, cancelled])

  const toEnter = (
    <div>
      <p>{`Enter "${entry}" to continue.`}</p>
      <input
        value={text}
        onInput={(e) => setText((e.target as HTMLInputElement).value)}
      />
    </div>
  )

  const confirm = (
    <Button
      className={styles.confirm}
      onClick={() => setConfirmed(true)}
      variant='primary'
    >
      {action}
    </Button>
  )

  return (
    <div className={styles.dialog}>
      <p>{prompt}</p>
      {entry ? toEnter : <></>}
      <div className={styles.actions}>
        {entry && text === entry ? confirm : <></>}
        <Button
          className={styles.cancel}
          onClick={() => setCancelled(true)}
          variant='primary'
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

export default ConfirmDialog
