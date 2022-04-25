import { useTranslation } from "next-i18next"
import Router from "next/router"
import React, { FormEvent, FunctionComponent, useEffect, useState } from "react"
import { toast } from "react-toastify"
import { initiateDonation } from "../../asyncs/payment"
import Button from "../Button"
import Spinner from "../Spinner"
import styles from "./DonationInput.module.scss"

const minDonation = 5

interface Props {
  org: string
}

const DonationInput: FunctionComponent<Props> = ({ org }) => {
  const { t } = useTranslation()

  const [amount, setAmount] = useState(minDonation.toFixed(2))
  const [submit, setSubmit] = useState(false)
  const [transaction, setTransaction] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setSubmit(true)
    initiateDonation(org, Number(amount) * 100)
      .then(setTransaction)
      .catch((err) => {
        toast.error(t(err))
        setSubmit(false)
      })
  }

  // Prevent entering fractional cents
  function handleChange(event: FormEvent<HTMLInputElement>) {
    const valueString = event.currentTarget.value

    if (valueString.match(/^\d*(\.\d{0,2})?$/)) {
      setAmount(valueString)
    }
  }

  // Always show cent value for consistency (removes ambiguity)
  function handleBlur(event: FormEvent<HTMLInputElement>) {
    // Don't use valueAsNumber to prevent NaN
    const value = Number(event.currentTarget.value)

    if (value < minDonation) {
      setAmount(minDonation.toFixed(2))
    } else {
      setAmount(value.toFixed(2))
    }
  }

  useEffect(() => {
    if (transaction) {
      Router.push(`payment/${transaction}`)
    }
  }, [transaction])

  if (submit) {
    return <Spinner size={30} />
  }

  const presets = [5, 10, 15, 20].map((val) => {
    return (
      <Button
        key={val}
        className={styles.amount}
        variant="secondary"
        type="button"
        onClick={() => setAmount(val.toString())}
      >
        ${val}
      </Button>
    )
  })

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h4>{t("select-donation-amount")}</h4>
      <div className={styles.options}>
        {presets}

        <div className={styles.amountInput}>
          <label>$</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d*(\.\d{0,2})?"
            value={amount}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        </div>
      </div>
      <Button>{t("make-donation")}</Button>
    </form>
  )
}

export default DonationInput
