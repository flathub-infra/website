import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import { Transaction } from "../../../types/Payment"
import styles from "./TransactionList.module.scss"
import TransactionListRow from "./TransactionListRow"

interface ListProps {
  transactions: Transaction[]
}

const TransactionList: FunctionComponent<ListProps> = ({ transactions }) => {
  const { t } = useTranslation()

  return (
    <table className={styles.transactionList}>
      <thead>
        <tr>
          <td>{t("created")}</td>
          <td>{t("updated")}</td>
          <td>{t("type")}</td>
          <td>{t("value")}</td>
          <td>{t("status")}</td>
          <td>{t("actions")}</td>
        </tr>
      </thead>
      <tbody>
        {transactions.length ? (
          transactions.map((transaction) => (
            <TransactionListRow
              key={transaction.id}
              transaction={transaction}
            />
          ))
        ) : (
          <tr>
            <td>{t("no-transaction-history")}</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

export default TransactionList
