import { useTranslation } from "next-i18next"
import { useTheme } from "next-themes"
import { FunctionComponent, MouseEventHandler } from "react"
import ReactCountryFlag from "react-country-flag"
import { IMAGE_BASE_URL } from "../../../env"
import { PaymentCard } from "../../../types/Payment"
import Image from "../../Image"

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

  const classes = [
    "grid grid-cols-3 grid-rows-3 shadow-md min-w-[200px] p-4 rounded-xl bg-bgColorSecondary",
  ]
  if (onClick) {
    classes.push("hover:cursor-pointer")
  }
  if (className) {
    classes.push(className)
  }

  return (
    <p className={classes.join(" ")} onClick={onClick}>
      <span className="col-start-1 row-start-1">
        <ReactCountryFlag countryCode={card.country} />
      </span>
      <span className="col-start-3 row-start-1 flex justify-center justify-self-end">
        <Image
          src={getBrandImage(card.brand, resolvedTheme)}
          width={30}
          height={24}
          alt=""
        />
      </span>
      <span className="col-span-3 row-start-2">{`**** **** **** ${card.last4}`}</span>
      <span className="col-span-3 row-start-3">
        {t("expiry")} {card.exp_month} / {card.exp_year}
      </span>
    </p>
  )
}

export default CardInfo
