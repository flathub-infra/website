import { useTranslation } from "next-i18next"
import { FunctionComponent, useCallback, useEffect, useState } from "react"
import { MdCancel, MdDelete } from "react-icons/md"
import { toast } from "react-toastify"
import { deletePaymentCard } from "../../../asyncs/payment"
import { useAsync } from "../../../hooks/useAsync"
import { PaymentCard } from "../../../types/Payment"
import Button from "../../Button"
import Spinner from "../../Spinner"
import styles from "./DeleteCardButton.module.scss"

interface Props {
  card: PaymentCard
  onSuccess: (card: PaymentCard) => void
}

const DeleteCardButton: FunctionComponent<Props> = ({ card, onSuccess }) => {
  const { t } = useTranslation()

  const [confirming, setConfirming] = useState(false)

  // The deletion request only happens once confirmed by secondary click
  const onConfirm = useCallback(() => deletePaymentCard(card), [card])
  const { execute, status, error } = useAsync(onConfirm, false)

  // If card was deleted backend, dispatch update to reflect in rendering
  useEffect(() => {
    if (status === "success") {
      onSuccess(card)
    }
  }, [status, onSuccess, card])

  // If deletion fails, user can always retry
  useEffect(() => {
    if (error) {
      toast.error(t(error))
      setConfirming(false)
    }
  }, [error, t])

  if (status === "pending") {
    return <Spinner size={30} />
  }

  if (confirming) {
    return (
      <div className={styles.confirmContainer}>
        <Button
          variant="secondary"
          onClick={() => setConfirming(false)}
          aria-label={t("cancel")}
          title={t("cancel")}
        >
          <MdCancel className={styles.mdButton} />
        </Button>
        <Button
          variant="secondary"
          onClick={execute}
          aria-label={t("delete")}
          title={t("delete")}
        >
          <MdDelete className={styles.mdButton} />
        </Button>
      </div>
    )
  }

  return (
    <Button variant="secondary" onClick={() => setConfirming(true)}>
      {t("remove-saved-card")}
    </Button>
  )
}

export default DeleteCardButton
