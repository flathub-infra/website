import { FunctionComponent } from 'react'
import { Transaction } from '../../../types/Payment'
import TransactionInfo from './TransactionInfo'
import styles from './TransactionList.module.scss'

interface Props {
  transactions: Transaction[]
}

const TransactionList: FunctionComponent<Props> = ({ transactions }) => {
  return (
    <table className={styles.transactionList}>
      <thead>
        <tr>
          <td>Creation</td>
          <td>Updated</td>
          <td>Type</td>
          <td>Value</td>
          <td>Status</td>
        </tr>
      </thead>
      <tbody>
        {transactions.length ? (
          transactions.map((transaction) => (
            <TransactionInfo key={transaction.id} transaction={transaction} />
          ))
        ) : (
          <tr>
            <td>No transaction history to show.</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

export default TransactionList
