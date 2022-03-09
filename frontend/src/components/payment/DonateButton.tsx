import { useTranslation } from 'next-i18next'
import Router from 'next/router'
import { FunctionComponent, useEffect, useState } from 'react'
import { TRANSACTIONS_URL } from '../../env'
import Button from '../Button'
import Spinner from '../Spinner'

async function initiateDonation(
  success: (transaction_id: string) => void
) {
  const res = fetch(TRANSACTIONS_URL, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    // TODO: Replace hardcoded details
    body: JSON.stringify({
      summary: {
        value: 5000,
        currency: 'usd',
        kind: 'donation',
      },
      details: [{
        recipient: 'org.flathub.Flathub',
        amount: 5000,
        currency: 'usd',
        kind: 'donation'
      }]
    })
  })

  // TODO error handling
  const data = await (await res).json();
  success(data.id);
}

const DonateButton: FunctionComponent = () => {
  const { t } = useTranslation()
  // Using state to prevent user repeatedly initating fetches
  const [clicked, setClicked] = useState(false)
  const [transaction, setTransaction] = useState('')

  // Only make a request on first click
  useEffect(() => {
    if (clicked) { initiateDonation(setTransaction) }
  }, [clicked])

  useEffect(() => {
    if (transaction) { Router.push(`payment/${transaction}`) }
  }, [transaction])

  if (clicked) {
    return <Spinner size={30} />
  }

  return (
    <Button onClick={() => setClicked(true)}>
      Donate to Flathub
    </Button>
  )
}

export default DonateButton
