import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import { Payout } from "../../../types/Payment"
import { formatCurrency } from "../../../utils/localize"

interface Props {
  payout: Payout
}

const TransactionPayout: FunctionComponent<Props> = ({ payout }) => {
  const { t, i18n } = useTranslation()

  return (
    <div className="flex flex-wrap gap-3 rounded-xl bg-flathubWhite p-3 shadow-md dark:bg-flathubJet">
      <span>
        {formatCurrency(payout.amount / 100, i18n.language, payout.currency)}
      </span>
      <span>{t(`kind-${payout.kind}`)}</span>
      <span>{payout.recipient}</span>
    </div>
  )
}

export default TransactionPayout
