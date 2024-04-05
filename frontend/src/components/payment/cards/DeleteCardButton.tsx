import { useTranslation } from "next-i18next"
import { FunctionComponent, useState } from "react"
import { HiXCircle, HiTrash } from "react-icons/hi2"
import { toast } from "react-toastify"
import Button from "../../Button"
import Spinner from "../../Spinner"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PaymentCardInfo, WalletInfo } from "src/codegen/model"
import { postRemovecardWalletRemovecardPost } from "src/codegen"

const DeleteCardButton: FunctionComponent<{
  card: PaymentCardInfo
}> = ({ card }) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // The deletion request only happens once confirmed by secondary click
  const [confirming, setConfirming] = useState(false)

  const deleteCard = useMutation({
    mutationKey: ["remove-card", card.id],
    mutationFn: () =>
      postRemovecardWalletRemovecardPost(card, {
        withCredentials: true,
      }),
    onSuccess: () => {
      queryClient.setQueryData<WalletInfo>(["/walletinfo"], (wallet) => ({
        ...wallet,
        cards: wallet.cards.filter((c) => c.id != card.id),
      }))
    },
    // If deletion fails, user can always retry
    onError: (error) => {
      toast.error(t(error as unknown as string))
      setConfirming(false)
    },
  })

  if (deleteCard.isPending) {
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
