import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import { Payout } from "../../../types/Payment"

interface Props {
  payout: Payout
}

const TransactionPayout: FunctionComponent<Props> = ({ payout }) => {
  const { t, i18n } = useTranslation()

  return (
    <div className="flex flex-wrap gap-3 rounded-xl bg-bgColorSecondary p-3 shadow-md">
      <span>
        {new Intl.NumberFormat(i18n.language.substring(0, 2), {
          style: "currency",
          currency: payout.currency,
          currencyDisplay: "symbol",
        }).format(payout.amount / 100)}
      </span>
      <span>{t(`kind-${payout.kind}`)}</span>
      <span>{payout.recipient}</span>
    </div>
  )
}

export default TransactionPayout
