import { useTranslation } from "next-i18next"
import { FunctionComponent, useCallback, useEffect, useState } from "react"
import { HiXCircle, HiTrash } from "react-icons/hi2"
import { toast } from "react-toastify"
import { deletePaymentCard } from "../../../asyncs/payment"
import { PaymentCard } from "../../../types/Payment"
import Button from "../../Button"
import Spinner from "../../Spinner"
import { useMutation, useQueryClient } from "@tanstack/react-query"

interface Props {
  card: PaymentCard
}

const DeleteCardButton: FunctionComponent<Props> = ({ card }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // The deletion request only happens once confirmed by secondary click
  const [confirming, setConfirming] = useState(false)

  const deleteCard = useMutation<void, string>({
    mutationFn: () => deletePaymentCard(card),
    onSuccess: () => {
      queryClient.setQueryData<PaymentCard[]>(["/walletinfo"], (cards) =>
        cards.filter((c) => c.id != card.id),
      )
    },
    // If deletion fails, user can always retry
    onError: (error) => {
      toast.error(t(error))
      setConfirming(false)
    },
  })

  if (deleteCard.isLoading) {
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
          onClick={() => deleteCard.mutate()}
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
      className="w-[250px] min-w-[200px] max-w-[300px]"
      variant="secondary"
      onClick={() => setConfirming(true)}
    >
      {t("remove-saved-card")}
    </Button>
  )
}

export default DeleteCardButton
