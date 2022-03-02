import { FunctionComponent } from 'react'
import { useTranslation } from 'next-i18next'
import { PaymentCard } from '../../../types/Payment'
import styles from './CardInfo.module.scss'

interface Props {
  card: PaymentCard
}

const CardInfo: FunctionComponent<Props> = ({ card }) => {
  const { t } = useTranslation()

  return (
    <p className={styles.container}>
      <span className={styles.country}>{card.country}</span>
      <span className={styles.brand}>{card.brand}</span>
      <span className={styles.code}>{`**** **** **** ${card.last4}`}</span>
      <span className={styles.expiry}>
        {t('card-expiry', { month: card.exp_month, year: card.exp_year })}
      </span>
    </p>
  )
}

export default CardInfo
