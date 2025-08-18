import { useTranslations } from "next-intl"
import { FunctionComponent, useState } from "react"
import { HiXCircle, HiTrash } from "react-icons/hi2"
import { toast } from "sonner"
import Spinner from "../../Spinner"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PaymentCardInfo, WalletInfo } from "src/codegen/model"
import { postRemovecardWalletRemovecardPost } from "src/codegen"
import { Button } from "@/components/ui/button"

const DeleteCardButton: FunctionComponent<{
  card: PaymentCardInfo
}> = ({ card }) => {
  const t = useTranslations()
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
          size="lg"
          variant="secondary"
          onClick={() => setConfirming(false)}
          aria-label={t("cancel")}
          title={t("cancel")}
        >
          <HiXCircle className="text-2xl" />
        </Button>
        <Button
          size="lg"
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
      size="lg"
      className="w-[250px] min-w-[200px] max-w-[300px]"
      variant="secondary"
      onClick={() => setConfirming(true)}
    >
      {t("remove-saved-card")}
    </Button>
  )
}

export default DeleteCardButton
