import { useTranslation } from "next-i18next"
import Link from "next/link"
import { FunctionComponent, useState } from "react"
import { getIntlLocale } from "../../../localize"
import { Transaction } from "../../../types/Payment"
import { formatCurrency } from "../../../utils/localize"
import Button from "../../Button"
import TransactionCancelButton from "./TransactionCancelButton"

interface RowProps {
  transaction: Transaction
}

const TransactionListRow: FunctionComponent<RowProps> = ({ transaction }) => {
  const { t, i18n } = useTranslation()

  const { created, updated, kind, value, status } = transaction

  // Status may change through interaction
  const [shownStatus, setStatus] = useState(status)

  // Date object expects milliseconds since epoch
  const prettyCreated = new Date(created * 1000).toLocaleString(
    getIntlLocale(i18n.language),
  )
  const prettyUpdated = new Date(updated * 1000).toLocaleString(
    getIntlLocale(i18n.language),
  )
  const prettyValue = formatCurrency(value / 100, i18n.language)

  const needsAttention = ["new", "retry"].includes(shownStatus)

  return (
    <tr className="my-2 mx-0 min-w-[200px] rounded-xl bg-bgColorSecondary p-2 shadow-md">
      <td>{prettyCreated}</td>
      <td>{prettyUpdated}</td>
      <td>{t(`kind-${kind}`)}</td>
      <td>{prettyValue}</td>
      <td>{t(`status-${shownStatus}`)}</td>
      <td className="flex flex-col items-start gap-2">
        <Link
          href={`/payment/${
            needsAttention ? transaction.id : `details/${transaction.id}`
          }`}
          passHref
        >
          <Button variant={needsAttention ? "primary" : "secondary"}>
            {needsAttention ? t("checkout") : t("view")}
          </Button>
        </Link>
        {needsAttention ? (
          <TransactionCancelButton
            id={transaction.id}
            onSuccess={() => setStatus("cancelled")}
          />
        ) : (
          <></>
        )}
      </td>
    </tr>
  )
}

export default TransactionListRow
