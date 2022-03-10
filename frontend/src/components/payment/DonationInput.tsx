import { useTranslation } from 'next-i18next'
import Router from 'next/router'
import React, { FormEvent, FunctionComponent, useEffect, useState } from 'react'
import { TRANSACTIONS_URL } from '../../env'
import Button from '../Button'
import Spinner from '../Spinner'
import styles from './DonationInput.module.scss'

async function initiateDonation(amount: number): Promise<string> {
  const res = fetch(TRANSACTIONS_URL, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: {
        value: amount,
        currency: 'usd',
        kind: 'donation',
      },
      details: [
        {
          recipient: 'org.flathub.Flathub',
          amount,
          currency: 'usd',
          kind: 'donation',
        },
      ],
    }),
  })

  // TODO error handling
  const data = await (await res).json()
  return data.id
}

const DonationInput: FunctionComponent = () => {
  const { t } = useTranslation()

  const [amount, setAmount] = useState(5)
  const [submit, setSubmit] = useState(false)
  const [transaction, setTransaction] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setSubmit(true)
    const transactId = await initiateDonation(amount * 100)
    setTransaction(transactId)
  }

  function handleChange(event: FormEvent<HTMLInputElement>) {
    setAmount(event.currentTarget.valueAsNumber)
  }

  useEffect(() => {
    if (transaction) {
      Router.push(`payment/${transaction}`)
    }
  }, [transaction])

  if (submit) {
    return <Spinner size={30} />
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.amountInput}>
        <label>$</label>
        <input
          type='number'
          min='5'
          step='0.01'
          value={amount}
          onChange={handleChange}
        />
      </div>
      <Button>Donate to Flathub</Button>
    </form>
  )
}

export default DonationInput
