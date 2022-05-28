import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import { TransactionDetailed } from "../../../types/Payment"

interface Props {
  transaction: TransactionDetailed
}

const TransactionSummary: FunctionComponent<Props> = ({ transaction }) => {
  const { t, i18n } = useTranslation()

  const { id, created, updated, kind, value, status } = transaction.summary

  const prettyCreated = new Date(created * 1000).toLocaleString(
    i18n.language.substring(0, 2),
  )
  const prettyUpdated = new Date(updated * 1000).toLocaleString(
    i18n.language.substring(0, 2),
  )
  const prettyValue = new Intl.NumberFormat(i18n.language.substring(0, 2), {
    style: "currency",
    currency: "USD",
    currencyDisplay: "symbol",
  }).format(value / 100)

  return (
    <div className="rounded-xl bg-bgColorSecondary p-3 shadow-md">
      <p className="m-0">
        {t("transaction-summary-id", { id })}
        <br />
        {t("transaction-summary-created", { date: prettyCreated })}
        <br />
        {t("transaction-summary-updated", { date: prettyUpdated })}
        <br />
        {t("transaction-summary-type", { type: t(`kind-${kind}`) })}
        <br />
        {t("transaction-summary-value", { value: prettyValue })}
        <br />
        {t("transaction-summary-status", {
          status: t(`status-${status}`),
        })}
        <br />
        {transaction.receipt ? (
          <a href={transaction.receipt} target="_blank" rel="noreferrer">
            {t("stripe-receipt")}
          </a>
        ) : (
          <></>
        )}
      </p>
    </div>
  )
}

export default TransactionSummary
