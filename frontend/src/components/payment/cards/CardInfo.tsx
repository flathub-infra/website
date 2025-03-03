import { useTranslation } from "next-i18next"
import { useTheme } from "next-themes"
import { FunctionComponent, MouseEventHandler } from "react"
import ReactCountryFlag from "react-country-flag"
import Image from "next/image"
import { PaymentCardInfo } from "src/codegen"

import amex from "public/img/payment-methods/amex.svg"
import mastercard from "public/img/payment-methods/mastercard.svg"
import visa from "public/img/payment-methods/visa.svg"
import visaDark from "public/img/payment-methods/visa-dark.svg"
import { Skeleton } from "@/components/ui/skeleton"

interface Props {
  card: PaymentCardInfo
  onClick?: MouseEventHandler
  className?: string
}

function getBrandImage(brand: string, theme: string): string {
  switch (brand) {
    case "visa":
      return theme === "dark" ? visaDark.src : visa.src
    case "mastercard":
      return mastercard.src
    case "amex":
      return amex.src
    default:
      return ""
  }
}

export const CardInfoSkeleton: FunctionComponent = () => {
  return (
    <Skeleton className="grid grid-cols-3 grid-rows-3 shadow-md w-[250px] h-44 min-w-[200px] p-4 rounded-xl bg-flathub-white dark:bg-flathub-arsenic max-w-[300px]" />
  )
}

export const CardInfo: FunctionComponent<Props> = ({
  card,
  onClick,
  className,
}) => {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()

  const classes = [
    "grid grid-cols-3 grid-rows-3 shadow-md w-[250px] min-w-[200px] h-44 p-4 rounded-xl bg-flathub-white dark:bg-flathub-arsenic max-w-[300px]",
  ]
  if (onClick) {
    classes.push("hover:cursor-pointer")
  }
  if (className) {
    classes.push(className)
  }

  return (
    <div className={classes.join(" ")} onClick={onClick}>
      <span className="col-span-3 row-start-1 flex">
        <div className="ms-auto">
          <ReactCountryFlag countryCode={card.country} />
        </div>
      </span>
      <span className="col-span-3 row-start-2 flex items-center justify-between font-bold">
        <div className="flex flex-row">
          <span>*</span>
          <span>*</span>
          <span>*</span>
          <span>*</span>
        </div>
        <div className="flex flex-row">
          <span>*</span>
          <span>*</span>
          <span>*</span>
          <span>*</span>
        </div>
        <div className="flex flex-row">
          <span>*</span>
          <span>*</span>
          <span>*</span>
          <span>*</span>
        </div>
        <div className="flex flex-row">
          <span>{card.last4[0]}</span>
          <span>{card.last4[1]}</span>
          <span>{card.last4[2]}</span>
          <span>{card.last4[3]}</span>
        </div>
      </span>
      <span className="col-span-3 row-start-3 flex">
        <div className="flex flex-col font-bold ">
          <div className="text-gray-400 dark:text-gray-500">{t("expiry")}</div>
          <div className="text-flathub-dark-gunmetal  dark:text-flathub-gainsborow">
            {card.exp_month} / {card.exp_year}
          </div>
        </div>
        <div className="ms-auto flex flex-col justify-end font-bold">
          <Image
            src={getBrandImage(card.brand, resolvedTheme)}
            width={54}
            height={48}
            alt={card.brand}
          />
        </div>
      </span>
    </div>
  )
}
