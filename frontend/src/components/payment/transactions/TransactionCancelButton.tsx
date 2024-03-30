import { useTranslation } from "next-i18next"
import { FunctionComponent, useEffect, useState } from "react"
import { toast } from "react-toastify"
import Button from "../../Button"
import { cancelTransactionWalletTransactionsTxnCancelPost } from "src/codegen"

interface Props {
  id: string
  onSuccess?: () => void
  className?: string
}

const TransactionCancelButton: FunctionComponent<Props> = ({
  id,
  onSuccess,
  className,
}) => {
  const { t } = useTranslation()
  // Using state to prevent user repeatedly initating fetches
  const [clicked, setClicked] = useState(false)

  // Only make a request on first click
  useEffect(() => {
    if (clicked) {
      cancelTransactionWalletTransactionsTxnCancelPost(id, {
        withCredentials: true,
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
      className={className}
      onClick={() => setClicked(true)}
      variant="secondary"
    >
      {t("transaction-cancel")}
    </Button>
  )
}

export default TransactionCancelButton
