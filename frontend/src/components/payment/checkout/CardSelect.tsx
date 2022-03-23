import { useStripe } from '@stripe/react-stripe-js'
import { FunctionComponent, ReactElement, useEffect, useState } from 'react'
import { TRANSACTION_SET_CARD_URL } from '../../../env'
import { PaymentCard, TransactionDetailed } from '../../../types/Payment'
import Button from '../../Button'
import Spinner from '../../Spinner'
import CardInfo from '../cards/CardInfo'
import styles from '../cards/SavedCards.module.scss'

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

interface Props {
  transaction: TransactionDetailed
  clientSecret: string
  cards: PaymentCard[]
  submit: () => void
  skip: () => void
}

const CardSelect: FunctionComponent<Props> = ({
  transaction,
  clientSecret,
  cards,
  submit,
  skip,
}) => {
  const stripe = useStripe()

  const [useCard, setUseCard] = useState<PaymentCard>(null)

  // If saved card was selected, can just perform the transaction
  useEffect(() => {
    if (stripe && useCard) {
      setCard(transaction.summary.id, useCard).then((data) => {
        if (data.status === 'ok') {
          stripe
            .confirmCardPayment(clientSecret, {
              payment_method: useCard.id,
            })
            // TODO: handle reuslt.error or result.paymentIntent
            .then((result) => submit())
        }
      })
    }
  }, [transaction, clientSecret, cards, submit, stripe, useCard])

  let cardSection: ReactElement
  if (cards) {
    const cardElems = cards.map((card) => {
      return (
        <CardInfo key={card.id} card={card} onClick={() => setUseCard(card)} />
      )
    })

    cardSection = <div className={styles.cardList}>{cardElems}</div>
  } else {
    cardSection = <Spinner size={100} text='Loading saved payment methods...' />
  }

  // Always want to present the option to use a new card in case user
  // doesn't want to wait for slow network
  return (
    <div className='main-container'>
      <h3>Saved Cards</h3>
      {cardSection}
      <Button onClick={() => skip()}>Use new card</Button>
    </div>
  )
}

export default CardSelect
