import { useTranslation } from 'next-i18next'
import { FunctionComponent } from 'react'
import { Payout } from '../../../types/Payment'
import styles from './TransactionPayout.module.scss'

interface Props {
  payout: Payout
}

const TransactionPayout: FunctionComponent<Props> = ({ payout }) => {
  const { t, i18n } = useTranslation()

  return (
    <div className={styles.payout}>
      <span>
        {new Intl.NumberFormat(i18n.language.substring(0, 2), {
          style: 'currency',
          currency: payout.currency,
          currencyDisplay: 'symbol',
        }).format(payout.amount / 100)}
      </span>
      <span>{t(`kind-${payout.kind}`)}</span>
      <span>{payout.recipient}</span>
    </div>
  )
}

export default TransactionPayout
