import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useRouter } from 'next/router'
import { FunctionComponent, ReactElement, useEffect, useState } from 'react'
import {
  TRANSACTION_SAVE_CARD_URL,
  TRANSACTION_SET_CARD_URL,
  WALLET_INFO_URL,
} from '../../../env'
import { PaymentCard } from '../../../types/Payment'
import Button from '../../Button'
import Spinner from '../../Spinner'
import CardSelect from './CardSelect'
import styles from './PaymentForm.module.scss'

async function getCards() {
  // TODO: Error handling
  const res = await fetch(WALLET_INFO_URL, { credentials: 'include' })
  const data = await res.json()
  return data.cards
}

interface TransactionData {
  txn: object
  clientSecret: string
}

interface Props {
  transaction: TransactionData
}

const successRedirect = `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/payment/success`

// TODO major cleanup
const PaymentForm: FunctionComponent<Props> = ({ transaction }) => {
  const [fetched, setFetched] = useState(false)
  const [cards, setCards] = useState<PaymentCard[]>(null)
  const [useCard, setUseCard] = useState<PaymentCard>(null)
  const [newCard, setNewCard] = useState(false)

  // Cards should only be retrieved once, and can only be when logged in
  useEffect(() => {
    if (!fetched) {
      setFetched(true)
      getCards().then(setCards)
    }
  }, [fetched])

  const stripe = useStripe()
  const elements = useElements()
  const [saveCard, setSaveCard] = useState(false)
  const [processing, setProcessing] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!stripe || !elements) {
      // Load hasn't completed yet
      return
    }

    setProcessing(true)

    if (saveCard) {
      await fetch(TRANSACTION_SAVE_CARD_URL(transaction.txn.summary.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ save_card: 'on_session' }),
      })
    }

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: successRedirect,
      },
    })

    // Redirect will have occurred otherwise
    if (result.error) {
      // TODO
      setProcessing(false)
    }
  }

  const router = useRouter()
  useEffect(() => {
    if (stripe && useCard) {
      const setCard = async (card: PaymentCard) => {
        const res = await fetch(
          TRANSACTION_SET_CARD_URL(transaction.txn.summary.id),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify(card),
          }
        )
        const data = await res.json()
        if (data.status === 'ok') {
          stripe
            .confirmCardPayment(transaction.clientSecret, {
              payment_method: useCard.id,
            })
            // TODO: handle reuslt.error or result.paymentIntent
            .then((result) => router.push(successRedirect))
        }
      }

      setCard(useCard)
    }
  }, [transaction, stripe, router, cards, useCard])

  if (!newCard) {
    return <CardSelect cards={cards} select={setUseCard} skip={setNewCard} />
  }

  let controls: ReactElement
  if (processing) {
    controls = <Spinner size={100} />
  } else {
    controls = (
      <>
        <div>
          <input
            id='save-card'
            type='checkbox'
            checked={saveCard}
            onChange={() => setSaveCard(!saveCard)}
          />
          <label htmlFor='save-card'>Save Card for reuse</label>
        </div>
        <Button>Submit payment</Button>
      </>
    )
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <PaymentElement />
      {controls}
    </form>
  )
}

export default PaymentForm
