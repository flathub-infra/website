import { useTranslation } from "next-i18next"
import { FunctionComponent, useEffect, useState } from "react"
import { toast } from "react-toastify"
import { cancelTransaction } from "../../../asyncs/payment"
import Button from "../../Button"

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
