import { useTranslation } from "next-i18next"
import { useTheme } from "next-themes"
import { FunctionComponent, MouseEventHandler } from "react"
import ReactCountryFlag from "react-country-flag"
import { IMAGE_BASE_URL } from "../../../env"
import { PaymentCard } from "../../../types/Payment"
import Image from "../../Image"
import styles from "./CardInfo.module.scss"

interface Props {
  card: PaymentCard
  onClick?: MouseEventHandler
  className?: string
}

function getBrandImage(brand: string, theme: string): string {
  const dark = theme === "dark" && brand === "visa" ? "-dark" : ""
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
    <p className={classes.join(" ")} onClick={onClick}>
      <span className={styles.country}>
        <ReactCountryFlag countryCode={card.country} />
      </span>
      <span className={styles.brand}>
        <Image
          src={getBrandImage(card.brand, resolvedTheme)}
          width={30}
          height={24}
          alt=""
        />
      </span>
      <span className={styles.code}>{`**** **** **** ${card.last4}`}</span>
      <span className={styles.expiry}>
        {t("expiry")} {card.exp_month} / {card.exp_year}
      </span>
    </p>
  )
}

export default CardInfo
