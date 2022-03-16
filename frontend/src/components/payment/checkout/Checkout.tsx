import { useStripe } from '@stripe/react-stripe-js'
import { useRouter } from 'next/router'
import { FunctionComponent, ReactElement, useEffect, useState } from 'react'
import {
  TRANSACTION_CANCEL_URL,
  TRANSACTION_SET_CARD_URL,
  WALLET_INFO_URL,
} from '../../../env'
import { PaymentCard } from '../../../types/Payment'
import Button from '../../Button'
import Spinner from '../../Spinner'
import CardSelect from './CardSelect'
import styles from './Checkout.module.scss'
import PaymentForm from './PaymentForm'

async function getCards() {
  // TODO: Error handling
  const res = await fetch(WALLET_INFO_URL, { credentials: 'include' })
  const data = await res.json()
  return data.cards
}

async function setCard(transactionId: string, card: PaymentCard) {
  const res = await fetch(TRANSACTION_SET_CARD_URL(transactionId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(card),
  })
  return await res.json()
}

async function cancelTransaction(transactionId: string) {
  const res = await fetch(TRANSACTION_CANCEL_URL(transactionId), {
    method: 'POST',
    credentials: 'include',
  })
}

interface TransactionData {
  txn: object
  clientSecret: string
}

interface Props {
  transaction: TransactionData
}

const successRedirect = `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/payment/success`

const Checkout: FunctionComponent<Props> = ({ transaction }) => {
  const router = useRouter()
  const stripe = useStripe()

  const [currentStage, setStage] = useState(-1)
  const [cards, setCards] = useState<PaymentCard[]>(null)
  const [useCard, setUseCard] = useState<PaymentCard>(null)

  // Cards should only be retrieved once
  useEffect(() => {
    getCards().then((data) => {
      // User may have no saved cards to select from
      if (data.length) {
        setCards(data)
        setStage(0)
      } else {
        setStage(1)
      }
    })
  }, [])

  // If saved card was selected, can just perform the transaction
  useEffect(() => {
    if (stripe && useCard) {
      setCard(transaction.txn.summary.id, useCard).then((data) => {
        if (data.status === 'ok') {
          stripe
            .confirmCardPayment(transaction.clientSecret, {
              payment_method: useCard.id,
            })
            // TODO: handle reuslt.error or result.paymentIntent
            .then((result) => router.push(successRedirect))
        }
      })
    }
  }, [transaction, stripe, router, cards, useCard])

  let flowContent: ReactElement
  switch (currentStage) {
    // Card selection stage
    case 0:
      flowContent = (
        <CardSelect
          cards={cards}
          select={setUseCard}
          skip={() => setStage(1)}
        />
      )
      break
    // Card input stage
    case 1:
      flowContent = <PaymentForm transactionId={transaction.txn.summary.id} />
      break
    // Loading state
    default:
      flowContent = <Spinner size={100} />
  }

  return (
    <div className='main-container'>
      {flowContent}
      <Button
        type='secondary'
        className={styles.cancel}
        onClick={() => cancelTransaction(transaction.txn.summary.id)}
      >
        Cancel Transaction
      </Button>
    </div>
  )
}

export default Checkout
