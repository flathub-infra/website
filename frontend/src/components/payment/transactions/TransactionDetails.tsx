import { useTranslation } from 'next-i18next'
import { FunctionComponent } from 'react'
import { TransactionDetailed } from '../../../types/Payment'
import TransactionList from './TransactionList'
import TransactionPayout from './TransactionPayout'

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
        <h3>{t('transaction-summary')}</h3>
        <TransactionList transactions={[transaction.summary]} />
      </div>
      <div>
        <h3>{t('transaction-breakdown')}</h3>
        {entries}
      </div>
    </div>
  )
}

export default TransactionDetails
