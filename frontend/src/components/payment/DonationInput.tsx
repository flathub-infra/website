import { useTranslation } from "next-i18next"
import Router from "next/router"
import React, { FormEvent, FunctionComponent, useEffect, useState } from "react"
import { toast } from "react-toastify"
import { initiateDonation } from "../../asyncs/payment"
import { NumericInputValue } from "../../types/Input"
import Button from "../Button"
import CurrencyInput from "../CurrencyInput"
import Spinner from "../Spinner"

const minDonation = 5

interface Props {
  org: string
}

const DonationInput: FunctionComponent<Props> = ({ org }) => {
  const { t } = useTranslation()

  const [amount, setAmount] = useState<NumericInputValue>({
    live: minDonation,
    settled: minDonation,
  })
  const [submit, setSubmit] = useState(false)
  const [transaction, setTransaction] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setSubmit(true)
    initiateDonation(org, amount.settled * 100)
      .then(setTransaction)
      .catch((err) => {
        toast.error(t(err))
        setSubmit(false)
      })
  }

  useEffect(() => {
    if (transaction) {
      Router.push(`payment/${transaction}`)
    }
  }, [transaction])

  if (submit) {
    return <Spinner size="s" />
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
      className="my-5 mx-0 flex flex-col gap-5 rounded-xl bg-bgColorSecondary p-5"
      onSubmit={handleSubmit}
    >
      <h4 className="m-0">{t("select-donation-amount")}</h4>
      <div className="flex flex-wrap items-center justify-center gap-5">
        {presets}

        <CurrencyInput value={amount} setValue={setAmount} minimum={5} />
      </div>
      <Button>{t("make-donation")}</Button>
    </form>
  )
}

export default DonationInput
