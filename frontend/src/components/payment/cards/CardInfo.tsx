import { useTranslations } from "next-intl"
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
    <Skeleton className="grid grid-cols-3 grid-rows-3 w-[280px] h-[170px] min-w-[240px] p-5 rounded-2xl bg-gradient-to-br from-flathub-gainsborow/60 to-flathub-gainsborow/30 dark:from-flathub-arsenic dark:to-flathub-dark-gunmetal" />
  )
}

export const CardInfo: FunctionComponent<Props> = ({
  card,
  onClick,
  className,
}) => {
  const t = useTranslations()
  const { resolvedTheme } = useTheme()

  const classes = [
    "grid grid-cols-3 grid-rows-3 w-[280px] min-w-[240px] h-[170px] p-5 rounded-2xl",
    "bg-gradient-to-br from-flathub-gainsborow/80 via-flathub-gainsborow/40 to-flathub-white",
    "dark:from-flathub-arsenic dark:via-flathub-dark-gunmetal dark:to-flathub-arsenic/80",
    "shadow-lg transition-all duration-200 ease-in-out",
  ]
  if (onClick) {
    classes.push(
      "hover:cursor-pointer hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]",
    )
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
      <span className="col-span-3 row-start-2 flex items-center justify-between font-mono text-lg tracking-wider text-flathub-dark-gunmetal dark:text-flathub-lotion">
        <span>••••</span>
        <span>••••</span>
        <span>••••</span>
        <span className="font-semibold">{card.last4}</span>
      </span>
      <span className="col-span-3 row-start-3 flex items-end">
        <div className="flex flex-col">
          <div className="text-xs uppercase tracking-wide text-flathub-sonic-silver dark:text-flathub-spanish-gray">
            {t("expiry")}
          </div>
          <div className="font-semibold text-flathub-dark-gunmetal dark:text-flathub-lotion">
            {String(card.exp_month).padStart(2, "0")}/{card.exp_year}
          </div>
        </div>
        <div className="ms-auto">
          <Image
            src={getBrandImage(card.brand, resolvedTheme)}
            width={48}
            height={32}
            alt={card.brand}
            className="opacity-90"
          />
        </div>
      </span>
    </div>
  )
}
