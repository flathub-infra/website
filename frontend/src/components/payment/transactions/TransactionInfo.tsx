import { FunctionComponent, ReactElement } from 'react'
import { Transaction } from '../../../types/Payment'
import styles from './TransactionInfo.module.scss'

interface Props {
  transaction: Transaction
}

const TransactionInfo: FunctionComponent<Props> = ({ transaction }) => {
  const clientLocale = new Intl.NumberFormat().resolvedOptions().locale

  // Value is stored in indivisible units (cent, pennies, etc.)
  const value = transaction.value / 100

  let status: ReactElement
  if (transaction.status === 'new' || transaction.status === 'retry') {
    // TODO replace this ugly bare link
    status = <a href={`/payment/${transaction.id}`}>Requires attention</a>
  } else {
    status = <>{transaction.status}</>
  }

  // Date object expects milliseconds since epoch
  return (
    <tr className={styles.info}>
      <td>{new Date(transaction.created * 1000).toLocaleString()}</td>
      <td>{new Date(transaction.updated * 1000).toLocaleString()}</td>
      <td>{transaction.kind}</td>
      <td>
        {new Intl.NumberFormat(clientLocale, {
          style: 'currency',
          currency: 'USD',
          currencyDisplay: 'symbol',
        }).format(value)}
      </td>
      <td>{status}</td>
    </tr>
  )
}

export default TransactionInfo
