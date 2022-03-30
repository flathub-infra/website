import { useTranslation } from 'next-i18next'
import { useTheme } from 'next-themes'
import { FunctionComponent, MouseEventHandler } from 'react'
import { IMAGE_BASE_URL } from '../../../env'
import { PaymentCard } from '../../../types/Payment'
import Image from '../../Image'
import styles from './CardInfo.module.scss'

interface Props {
  card: PaymentCard
  onClick?: MouseEventHandler
  className?: string
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

function getBrandImage(brand: string, theme: string): string {
  const dark = theme === 'dark' && brand === 'visa' ? '-dark' : ''
  return `${IMAGE_BASE_URL}payment-methods/${brand}${dark}.svg`
}

const CardInfo: FunctionComponent<Props> = ({ card, onClick, className }) => {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()

  const classes = [styles.container]
  if (onClick) {
    classes.push(styles.clickable)
  }
  if (className) {
    classes.push(className)
  }

  return (
    <p className={classes.join(' ')} onClick={onClick}>
      <span className={styles.country}>{countryCodeToFlag(card.country)}</span>
      <span className={styles.brand}>
        <Image
          src={getBrandImage(card.brand, resolvedTheme)}
          width={30}
          height={24}
          alt=''
        />
      </span>
      <span className={styles.code}>{`**** **** **** ${card.last4}`}</span>
      <span className={styles.expiry}>
        {t('card-expiry', { month: card.exp_month, year: card.exp_year })}
      </span>
    </p>
  )
}

export default CardInfo
