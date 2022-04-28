import { useTranslation } from "next-i18next"
import { FunctionComponent, useEffect, useState } from "react"
import { toast } from "react-toastify"
import { TRANSACTION_CANCEL_URL } from "../../../env"
import Button from "../../Button"

/**
 * Performs API request to cancel an active transaction
 * @param transactionId ID of the transaction to cancel
 */
async function cancelTransaction(transactionId: string) {
  let res: Response
  try {
    res = await fetch(TRANSACTION_CANCEL_URL(transactionId), {
      method: "POST",
      credentials: "include",
    })
  } catch {
    throw "network-error-try-again"
  }

  if (!res.ok) {
    throw "network-error-try-again"
  }
}

interface Props {
  id: string
  onSuccess?: () => void
}

const TransactionCancelButton: FunctionComponent<Props> = ({
  id,
  onSuccess,
}) => {
  const { t } = useTranslation()
  // Using state to prevent user repeatedly initating fetches
  const [clicked, setClicked] = useState(false)

  // Only make a request on first click
  useEffect(() => {
    if (clicked) {
      cancelTransaction(id)
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
    <Button onClick={() => setClicked(true)} variant="secondary">
      {t("transaction-cancel")}
    </Button>
  )
}

export default TransactionCancelButton
