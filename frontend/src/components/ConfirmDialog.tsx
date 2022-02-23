import { FunctionComponent, useEffect, useState } from 'react'
import Button from './Button'
import styles from './ConfirmDialog.module.scss'

interface Props {
  prompt: string,
  action: string,
  onConfirmed: () => void,
  onCancelled: () => void
}

/** A dialog to confirm an action and perform a callback function on
 * confirmation or cancellation.
 */
const ConfirmDialog: FunctionComponent<Props> = ({
  prompt,
  action,
  onConfirmed,
  onCancelled
}) => {
  const [confirmed, setConfirmed] = useState(false)
  const [cancelled, setCancelled] = useState(false)

  useEffect(() => {
    if (confirmed) onConfirmed()
  }, [onConfirmed, confirmed])

  useEffect(() => {
    if (cancelled) onCancelled()
  }, [onCancelled, cancelled])

  return (<div className={styles.dialog}>
    <p>{prompt}</p>
    <Button onClick={() => setConfirmed(true)} type='primary'>{action}</Button>
    <Button onClick={() => setCancelled(true)} type='primary'>Cancel</Button>
  </div>)
}

export default ConfirmDialog
