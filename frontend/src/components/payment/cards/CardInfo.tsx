import { useTranslation } from 'next-i18next'
import { FunctionComponent, MouseEventHandler } from 'react'
import { PaymentCard } from '../../../types/Payment'
import styles from './CardInfo.module.scss'

interface Props {
  card: PaymentCard
  onClick?: MouseEventHandler
}

const CardInfo: FunctionComponent<Props> = ({ card, onClick }) => {
  const { t } = useTranslation()

  return (
    <p
      className={`${styles.container} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
    >
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
