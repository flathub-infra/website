import { FunctionComponent, useEffect, useMemo } from "react"
import { Appstream } from "../../../types/Appstream"
import { computeAppShares, computeShares } from "../../../utils/vending"
import { formatCurrency } from "src/utils/localize"
import { useLocale, useTranslations } from "next-intl"
import { VendingConfig } from "src/codegen"

import * as Slider from "@radix-ui/react-slider"
import clsx from "clsx"
import { getIntlLocale } from "src/localize"
import { useRouter } from "src/i18n/navigation"

interface Props {
  price: number
  app: Pick<Appstream, "id" | "name" | "bundle">
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
    <div>
      <div className="w-full max-w-md pt-8 px-4 pb-4">
        <div className="relative mb-4">
          <div
            className="absolute -top-10 transform -translate-x-1/2 transition-all duration-100"
            style={{ left: `${appPercentage}%` }}
          >
            <span className="text-sm font-medium text-flathub-celestial-blue-dark dark:text-flathub-celestial-blue">
              {Intl.NumberFormat(i18n.language, {
                style: "percent",
              }).format(appPercentage / 100)}
            </span>
          </div>

          <Slider.Root
            className="relative flex items-center select-none touch-none w-full h-3"
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
            <Slider.Track className="relative grow rounded-sm h-3 overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-100"
                style={{ width: `${appPercentage}%` }}
                aria-hidden="true"
              />

              <div
                className="absolute top-0 h-full bg-red-500 transition-all duration-100"
                style={{
                  left: `${appPercentage}%`,
                  width: `${sdkPercentage}%`,
                }}
                aria-hidden="true"
              />

              <div
                className="absolute top-0 h-full bg-orange-400 transition-all duration-100"
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

        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 bg-blue-500 rounded-full"
              aria-hidden="true"
            ></div>
            <div className="text-sm">
              <div className="font-semibold">
                {t("vendingSharesPreview.app")}
              </div>
              <div
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
          <div className="flex gap-6">
            {/* SDK section */}
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 bg-red-500 rounded-full"
                aria-hidden="true"
              ></div>
              <div className="text-sm">
                <div className="font-semibold">
                  {t("vendingSharesPreview.sdk")}
                </div>
                <div
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
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 bg-orange-400 rounded-full"
                aria-hidden="true"
              ></div>
              <div className="text-sm">
                <div className="font-semibold">{t("flathub")}</div>
                <div
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
