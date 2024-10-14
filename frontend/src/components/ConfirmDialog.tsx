import { FunctionComponent, PropsWithChildren } from "react"
import Modal from "./Modal"

interface Props {
  isVisible: boolean
  prompt: string
  description?: string
  action: string
  actionVariant?: "default" | "secondary" | "destructive"
  onConfirmed: () => void
  onCancelled: () => void
  submitDisabled?: boolean
}

/** A dialog to confirm an action and perform a callback function on
 * confirmation or cancellation.
 */
const ConfirmDialog: FunctionComponent<PropsWithChildren<Props>> = ({
  isVisible,
  prompt,
  description,
  action,
  actionVariant,
  onConfirmed,
  onCancelled,
  submitDisabled = false,
  children,
}) => {
  return (
    <Modal
      shown={isVisible}
      title={prompt}
      onClose={onCancelled}
      description={description}
      submitButton={{
        onClick: onConfirmed,
        label: action,
        disabled: submitDisabled,
        variant: actionVariant,
      }}
      cancelButton={{ onClick: onCancelled }}
    >
      {children}
    </Modal>
  )
}

export default ConfirmDialog
