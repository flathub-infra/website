import { useTranslation } from 'next-i18next'
import { FunctionComponent, MouseEventHandler } from 'react'
import { PaymentCard } from '../../../types/Payment'
import styles from './CardInfo.module.scss'

interface Props {
  card: PaymentCard
  onClick?: MouseEventHandler
}

/**
 * Converts country code to corresponding emoji flag
 * @param code ISO-3166-1 alpha-2 code of coutnry
 * @returns emoji flag string (two regional indicator characters)
 */
function countryCodeToFlag(code: string): string {
  // Consistent 127,397 offset from capital to regional indicator
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397))
}

const CardInfo: FunctionComponent<Props> = ({ card, onClick }) => {
  const { t } = useTranslation()

  return (
    <p
      className={`${styles.container} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
    >
      <span className={styles.country}>{countryCodeToFlag(card.country)}</span>
      <span className={styles.brand}>{card.brand}</span>
      <span className={styles.code}>{`**** **** **** ${card.last4}`}</span>
      <span className={styles.expiry}>
        {t('card-expiry', { month: card.exp_month, year: card.exp_year })}
      </span>
    </p>
  )
}

export default CardInfo
