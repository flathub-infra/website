import { useTranslation } from "next-i18next"
import { FunctionComponent, useCallback, useEffect, useState } from "react"
import { HiXCircle, HiTrash } from "react-icons/hi2"
import { toast } from "react-toastify"
import { deletePaymentCard } from "../../../asyncs/payment"
import { useAsync } from "../../../hooks/useAsync"
import { PaymentCard } from "../../../types/Payment"
import Button from "../../Button"
import Spinner from "../../Spinner"

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
    return <Spinner size="s" />
  }

  if (confirming) {
    return (
      <div className="flex justify-evenly gap-4">
        <Button
          variant="secondary"
          onClick={() => setConfirming(false)}
          aria-label={t("cancel")}
          title={t("cancel")}
        >
          <HiXCircle className="text-2xl" />
        </Button>
        <Button
          variant="destructive"
          onClick={execute}
          aria-label={t("delete")}
          title={t("delete")}
        >
          <HiTrash className="text-2xl" />
        </Button>
      </div>
    )
  }

  return (
    <Button
      className="w-full"
      variant="secondary"
      onClick={() => setConfirming(true)}
    >
      {t("remove-saved-card")}
    </Button>
  )
}

export default DeleteCardButton
