import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import { getIntlLocale } from "../../../localize"
import { TransactionDetailed } from "../../../types/Payment"
import { formatCurrency } from "../../../utils/localize"

interface Props {
  transaction: TransactionDetailed
}

const TransactionSummary: FunctionComponent<Props> = ({ transaction }) => {
  const { t, i18n } = useTranslation()

  const { id, created, updated, kind, value, status } = transaction.summary

  const prettyCreated = new Date(created * 1000).toLocaleString(
    getIntlLocale(i18n.language),
  )
  const prettyUpdated = new Date(updated * 1000).toLocaleString(
    getIntlLocale(i18n.language),
  )
  const prettyValue = formatCurrency(value / 100, i18n.language)

  return (
    <div className="rounded-xl bg-flathub-white p-3 shadow-md dark:bg-flathub-arsenic">
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
          <a
            href={transaction.receipt}
            className="no-underline hover:underline"
            target="_blank"
            rel="noreferrer"
          >
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
