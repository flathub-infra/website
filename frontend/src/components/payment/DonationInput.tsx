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
        credentials: "include",
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
    return (
      <Button
        size="lg"
        key={val}
        variant="secondary"
        type="button"
        onClick={() => setAmount({ ...amount, settled: val })}
      >
        {formatCurrency(val, i18n.language, currency)}
      </Button>
    )
  })

  return (
    <form
      className="mx-0 mt-5 flex flex-col gap-5 rounded-xl bg-flathub-white p-5 dark:bg-flathub-arsenic h-min"
      onSubmit={handleSubmit}
    >
      <h4 className="m-0 text-base font-normal">
        {t("select-donation-amount")}
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 items-center justify-center gap-3">
        {presets}
      </div>
      <div className="pt-5">
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
