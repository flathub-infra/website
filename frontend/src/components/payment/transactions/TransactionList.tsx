import { useTranslation } from 'next-i18next'
import Link from 'next/link'
import { FunctionComponent } from 'react'
import { Transaction } from '../../../types/Payment'
import Button from '../../Button'
import styles from './TransactionList.module.scss'

interface ListProps {
  transactions: Transaction[]
}

const TransactionList: FunctionComponent<ListProps> = ({ transactions }) => {
  const { t } = useTranslation()

  return (
    <table className={styles.transactionList}>
      <thead>
        <tr>
          <td>{t('created')}</td>
          <td>{t('updated')}</td>
          <td>{t('id')}</td>
          <td>{t('type')}</td>
          <td>{t('value')}</td>
          <td>{t('status')}</td>
          <td>{t('actions')}</td>
        </tr>
      </thead>
      <tbody>
        {transactions.length ? (
          transactions.map((transaction) => (
            <TransactionInfo key={transaction.id} transaction={transaction} />
          ))
        ) : (
          <tr>
            <td>{t('no-transaction-history')}</td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

interface RowProps {
  transaction: Transaction
}

const TransactionInfo: FunctionComponent<RowProps> = ({ transaction }) => {
  const { t, i18n } = useTranslation()

  const { id, created, updated, kind, value, status } = transaction

  const prettyCreated = new Date(created * 1000).toLocaleString()
  const prettyUpdated = new Date(updated * 1000).toLocaleString()
  const prettyValue = new Intl.NumberFormat(i18n.language, {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'symbol',
  }).format(value / 100)

  const needsAttention =
    transaction.status === 'new' || transaction.status === 'retry'

  // Date object expects milliseconds since epoch
  return (
    <tr className={styles.info}>
      <td>{prettyCreated}</td>
      <td>{prettyUpdated}</td>
      <td>{id}</td>
      <td>{kind}</td>
      <td>{prettyValue}</td>
      <td>{status}</td>
      <td className={styles.actions}>
        <Link
          href={`/payment/${
            needsAttention ? transaction.id : `details/${transaction.id}`
          }`}
          passHref
        >
          <Button type={needsAttention ? 'primary' : 'secondary'}>
            {needsAttention ? t('checkout') : t('view')}
          </Button>
        </Link>
      </td>
    </tr>
  )
}

export default TransactionList
