import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"
import { FunctionComponent, useEffect, useState } from "react"
import { toast } from "sonner"
import { cancelTransactionWalletTransactionsTxnCancelPost } from "src/codegen"

interface Props {
  id: string
  onSuccess?: () => void
  className?: string
  disabled?: boolean
}

const TransactionCancelButton: FunctionComponent<Props> = ({
  id,
  onSuccess,
  className,
  disabled = false,
}) => {
  const t = useTranslations()
  // Using state to prevent user repeatedly initating fetches
  const [clicked, setClicked] = useState(false)

  // Only make a request on first click
  useEffect(() => {
    if (clicked) {
      cancelTransactionWalletTransactionsTxnCancelPost(id, {
        credentials: "include",
      })
        .then(() => {
          toast.success(t("transaction-cancelled"))
          if (onSuccess) {
            onSuccess()
          }
        })
        .catch((err) => {
          toast.error(t(err))
          setClicked(false)
        })
    }
  }, [id, onSuccess, clicked, t])

  return (
    <Button
      size="lg"
      disabled={disabled || clicked}
      className={className}
      onClick={() => setClicked(true)}
      variant="secondary"
    >
      {t("transaction-cancel")}
    </Button>
  )
}

export default TransactionCancelButton
