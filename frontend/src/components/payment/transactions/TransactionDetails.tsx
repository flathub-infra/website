import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import { TransactionDetailed } from "../../../types/Payment"
import TransactionPayout from "./TransactionPayout"
import TransactionSummary from "./TransactionSummary"

interface Props {
  transaction: TransactionDetailed
}

const TransactionDetails: FunctionComponent<Props> = ({ transaction }) => {
  const { t } = useTranslation()

  const entries = transaction.details.map((entry) => {
    return <TransactionPayout key={entry.recipient} payout={entry} />
  })

  return (
    <div>
      <div>
        <h3 className="my-4 text-xl font-semibold">
          {t("transaction-summary")}
        </h3>
        <TransactionSummary transaction={transaction} />
      </div>
      <div>
        <h3 className="my-4 text-xl font-semibold">
          {t("transaction-breakdown")}
        </h3>
        <div className="flex flex-col gap-3 rounded-xl bg-flathub-white p-3 shadow-md dark:bg-flathub-arsenic">
          {entries}
        </div>
      </div>
    </div>
  )
}

export default TransactionDetails
