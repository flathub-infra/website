import { FunctionComponent, useEffect, useMemo } from "react"
import { computeAppShares, computeShares } from "../../../utils/vending"
import { formatCurrency } from "src/utils/localize"
import { useLocale, useTranslations } from "next-intl"
import { GetAppstreamAppstreamAppIdGet200, VendingConfig } from "src/codegen"

import * as Slider from "@radix-ui/react-slider"
import clsx from "clsx"
import { getIntlLocale } from "src/localize"
import { useRouter } from "src/i18n/navigation"

interface Props {
  price: number
  app: Pick<GetAppstreamAppstreamAppIdGet200, "id" | "name" | "bundle">
  appShare: number
  setAppShare: (share: number) => void
  vendingConfig: VendingConfig
  interactive?: boolean
}

/**
 * An element to visualise the breakdown of price based on the set app share for vending.
 *
 * TODO: Use robust currency formatting once multiple currencies are supported
 */
const VendingSharesPreview: FunctionComponent<Props> = ({
  price,
  app,
  appShare,
  setAppShare,
  vendingConfig,
  interactive = false,
}) => {
  const t = useTranslations()
  const router = useRouter()
  const locale = useLocale()
  const i18n = getIntlLocale(locale)

  // Don't re-run computations unnecessarily
  const shares = useMemo(
    () => computeShares(app, appShare, vendingConfig),
    [app, appShare, vendingConfig],
  )
  const breakdown = useMemo(
    () => (price > 0 ? computeAppShares(price, shares, vendingConfig) : []),
    [price, shares, vendingConfig],
  )

  if (price <= 0) {
    return <></>
  }

  const appCost = breakdown[0][1] / 100
  const appPercentage = (breakdown[0][1] / price) * 100
  const sdkShare = breakdown[1][1] / 100
  const sdkPercentage = (breakdown[1][1] / price) * 100
  const flathubShare = breakdown[2][1] / 100
  const flathubPercentage = (breakdown[2][1] / price) * 100

  return (
    <div className="rounded-xl bg-flathub-gainsborow/30 dark:bg-flathub-dark-gunmetal/50 p-4">
      <div className="w-full max-w-md pt-6 pb-2">
        <div className="relative mb-5">
          <div
            className="absolute -top-8 transform -translate-x-1/2 transition-all duration-200 ease-out"
            style={{ left: `${appPercentage}%` }}
          >
            <span className="text-sm font-semibold text-flathub-celestial-blue px-2 py-0.5 rounded-full bg-flathub-celestial-blue/10">
              {Intl.NumberFormat(i18n.language, {
                style: "percent",
              }).format(appPercentage / 100)}
            </span>
          </div>

          <Slider.Root
            className="relative flex items-center select-none touch-none w-full h-4"
            value={[appPercentage]}
            onValueChange={(value) => {
              setAppShare(value[0])
            }}
            max={100}
            min={0}
            step={1}
            aria-label={t("vendingSharesPreview.sliderLabel")}
            disabled={!interactive}
          >
            <Slider.Track className="relative grow rounded-full h-4 overflow-hidden shadow-inner bg-flathub-gainsborow/50 dark:bg-flathub-granite-gray/30">
              <div
                className="absolute top-0 start-0 h-full bg-gradient-to-r from-flathub-celestial-blue to-blue-400 transition-all duration-200 ease-out"
                style={{ width: `${appPercentage}%` }}
                aria-hidden="true"
              />

              <div
                className="absolute top-0 h-full bg-gradient-to-r from-rose-500 to-red-400 transition-all duration-200 ease-out"
                style={{
                  left: `${appPercentage}%`,
                  width: `${sdkPercentage}%`,
                }}
                aria-hidden="true"
              />

              <div
                className="absolute top-0 h-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-200 ease-out"
                style={{
                  left: `${appPercentage + sdkPercentage}%`,
                  width: `${flathubPercentage}%`,
                }}
                aria-hidden="true"
              />

              {/* Range (invisible but required by Radix) */}
              <Slider.Range className="absolute h-full opacity-0" />
            </Slider.Track>

            {interactive && (
              <Slider.Thumb
                className={clsx(
                  "block w-2 h-6 rounded-sm shadow-md transition-colors duration-100",
                  "bg-flathub-celestial-blue-dark dark:bg-flathub-celestial-blue hover:bg-blue-700 focus:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  "cursor-grab active:cursor-grabbing",
                )}
                aria-label={t("vendingSharesPreview.sliderThumbLabel", {
                  percentage: Intl.NumberFormat(i18n.language, {
                    style: "percent",
                  }).format(appPercentage / 100),
                })}
              />
            )}
          </Slider.Root>
        </div>

        <div className="flex flex-wrap justify-between items-start gap-4 mt-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-3 h-3 bg-gradient-to-br from-flathub-celestial-blue to-blue-400 rounded-full shadow-sm"
              aria-hidden="true"
            ></div>
            <div className="text-sm">
              <div className="font-semibold text-flathub-dark-gunmetal dark:text-flathub-lotion">
                {t("vendingSharesPreview.app")}
              </div>
              <div
                className="text-flathub-sonic-silver dark:text-flathub-spanish-gray font-medium"
                aria-label={t(`vendingSharesPreview.appShare`, {
                  percentage: Intl.NumberFormat(i18n.language, {
                    style: "percent",
                  }).format(appPercentage / 100),
                })}
              >
                {formatCurrency(appCost)}
              </div>
            </div>
          </div>

          {/* Right side - SDK and Flathub */}
          <div className="flex gap-5">
            {/* SDK section */}
            <div className="flex items-center gap-2.5">
              <div
                className="w-3 h-3 bg-gradient-to-br from-rose-500 to-red-400 rounded-full shadow-sm"
                aria-hidden="true"
              ></div>
              <div className="text-sm">
                <div className="font-semibold text-flathub-dark-gunmetal dark:text-flathub-lotion">
                  {t("vendingSharesPreview.sdk")}
                </div>
                <div
                  className="text-flathub-sonic-silver dark:text-flathub-spanish-gray font-medium"
                  aria-label={t(`vendingSharesPreview.sdkShare`, {
                    percentage: Intl.NumberFormat(i18n.language, {
                      style: "percent",
                    }).format(sdkPercentage / 100),
                  })}
                >
                  {formatCurrency(sdkShare)}
                </div>
              </div>
            </div>

            {/* Flathub section */}
            <div className="flex items-center gap-2.5">
              <div
                className="w-3 h-3 bg-gradient-to-br from-amber-500 to-orange-400 rounded-full shadow-sm"
                aria-hidden="true"
              ></div>
              <div className="text-sm">
                <div className="font-semibold text-flathub-dark-gunmetal dark:text-flathub-lotion">
                  {t("flathub")}
                </div>
                <div
                  className="text-flathub-sonic-silver dark:text-flathub-spanish-gray font-medium"
                  aria-label={t(`vendingSharesPreview.flathubShare`, {
                    percentage: Intl.NumberFormat(i18n.language, {
                      style: "percent",
                    }).format(flathubPercentage / 100),
                  })}
                >
                  {formatCurrency(flathubShare)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sr-only">
          {t("vendingSharesPreview.screenReaderBreakdown", {
            appPercentage: Intl.NumberFormat(i18n.language, {
              style: "percent",
            }).format(appPercentage / 100),
            sdkPercentage: Intl.NumberFormat(i18n.language, {
              style: "percent",
            }).format(sdkPercentage / 100),
            flathubPercentage: Intl.NumberFormat(i18n.language, {
              style: "percent",
            }).format(flathubPercentage / 100),
            totalCost: formatCurrency(price / 100),
          })}
        </div>
      </div>
    </div>
  )
}

export default VendingSharesPreview
