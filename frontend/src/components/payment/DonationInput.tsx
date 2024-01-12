import { useTranslation } from "next-i18next"
import Router from "next/router"
import React, { FormEvent, FunctionComponent, useEffect, useState } from "react"
import { toast } from "react-toastify"
import { FLATHUB_MIN_PAYMENT, STRIPE_MAX_PAYMENT } from "../../env"
import { NumericInputValue } from "../../types/Input"
import Button from "../Button"
import * as Currency from "../currency"
import Spinner from "../Spinner"
import { walletApi } from "src/api"

interface Props {
  org: string
}

const DonationInput: FunctionComponent<Props> = ({ org }) => {
  const { t } = useTranslation()

  const [amount, setAmount] = useState<NumericInputValue>({
    live: FLATHUB_MIN_PAYMENT,
    settled: FLATHUB_MIN_PAYMENT,
  })
  const [submit, setSubmit] = useState(false)
  const [transaction, setTransaction] = useState<string>("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setSubmit(true)
    walletApi
      .createTransactionWalletTransactionsPost(
        {
          summary: {
            value: amount.settled * 100,
            currency: "usd",
            kind: "donation",
          },
          details: [
            {
              recipient: org,
              amount: amount.settled * 100,
              currency: "usd",
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
      Router.push(`payment/${transaction}`, undefined, {
        locale: Router.locale,
      })
    }
  }, [transaction])

  if (submit) {
    return <Spinner size="l" />
  }

  const presets = [5, 10, 15, 20].map((val) => {
    return (
      <Button
        key={val}
        variant="secondary"
        type="button"
        onClick={() => setAmount({ ...amount, settled: val })}
      >
        ${val}
      </Button>
    )
  })

  return (
    <form
      className="mx-0 my-5 flex flex-col gap-5 rounded-xl bg-flathub-white p-5 dark:bg-flathub-arsenic"
      onSubmit={handleSubmit}
    >
      <h4 className="m-0 text-base font-normal">
        {t("select-donation-amount")}
      </h4>
      <div className="flex flex-wrap items-center justify-center gap-5">
        {presets}

        <div>
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
      </div>
      <Button
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
