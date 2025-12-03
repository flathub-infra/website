import { useLocale, useTranslations } from "next-intl"
import React, { FormEvent, FunctionComponent, useEffect, useState } from "react"
import { toast } from "sonner"
import { FLATHUB_MIN_PAYMENT, STRIPE_MAX_PAYMENT } from "../../env"
import { NumericInputValue } from "../../types/Input"
import * as Currency from "../currency"
import Spinner from "../Spinner"
import { createTransactionWalletTransactionsPost } from "src/codegen"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "src/utils/localize"
import { getIntlLocale } from "src/localize"
import { redirect } from "src/i18n/navigation"

interface Props {
  org: string
}

const DonationInput: FunctionComponent<Props> = ({ org }) => {
  const t = useTranslations()
  const locale = useLocale()
  const i18n = getIntlLocale(locale)

  const currency = "USD"

  const [amount, setAmount] = useState<NumericInputValue>({
    live: FLATHUB_MIN_PAYMENT,
    settled: FLATHUB_MIN_PAYMENT,
  })
  const [submit, setSubmit] = useState(false)
  const [transaction, setTransaction] = useState<string>("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setSubmit(true)
    createTransactionWalletTransactionsPost(
      {
        summary: {
          value: amount.settled * 100,
          currency,
          kind: "donation",
        },
        details: [
          {
            recipient: org,
            amount: amount.settled * 100,
            currency,
            kind: "donation",
          },
        ],
      },
      {
        withCredentials: true,
      },
    )
      .then((result) => setTransaction(result.data.id))
      .catch((err) => {
        toast.error(t(err))
        setSubmit(false)
      })
  }

  useEffect(() => {
    if (transaction) {
      redirect({ href: `payment/${transaction}`, locale })
    }
  }, [transaction, locale])

  if (submit) {
    return <Spinner size="l" />
  }

  const presets = [5, 10, 15, 20].map((val) => {
    const isSelected = amount.settled === val
    return (
      <Button
        size="lg"
        key={val}
        variant={isSelected ? "default" : "secondary"}
        type="button"
        onClick={() => setAmount({ ...amount, settled: val })}
        className={
          isSelected ? "ring-2 ring-flathub-celestial-blue ring-offset-2" : ""
        }
      >
        {formatCurrency(val, i18n.language, currency)}
      </Button>
    )
  })

  return (
    <form
      className="mx-0 mt-5 flex flex-col gap-5 rounded-xl bg-flathub-white p-5 dark:bg-flathub-arsenic h-min shadow-md"
      onSubmit={handleSubmit}
    >
      <h4 className="m-0 text-lg font-semibold">
        {t("select-donation-amount")}
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 items-center justify-center gap-3">
        {presets}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {t("or-enter-custom-amount")}
        </label>
        <Currency.Input
          inputValue={amount}
          setValue={setAmount}
          maximum={STRIPE_MAX_PAYMENT}
        />
        <Currency.MinMaxError
          value={amount}
          minimum={FLATHUB_MIN_PAYMENT}
          maximum={STRIPE_MAX_PAYMENT}
        />
      </div>
      <Button
        size="lg"
        className="w-full"
        disabled={
          amount.live < FLATHUB_MIN_PAYMENT || amount.live > STRIPE_MAX_PAYMENT
        }
      >
        {t("make-donation")}
      </Button>
    </form>
  )
}

export default DonationInput
