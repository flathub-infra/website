import { useRouter } from 'next/router'
import { FunctionComponent, ReactElement, useEffect, useState } from 'react'
import { TRANSACTION_CANCEL_URL, WALLET_INFO_URL } from '../../../env'
import { PaymentCard, TransactionDetailed } from '../../../types/Payment'
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

async function cancelTransaction(transactionId: string) {
  const res = await fetch(TRANSACTION_CANCEL_URL(transactionId), {
    method: 'POST',
    credentials: 'include',
  })
}

interface Props {
  transaction: TransactionDetailed
  clientSecret: string
}

const successRedirect = `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/payment/success`

const Checkout: FunctionComponent<Props> = ({ transaction, clientSecret }) => {
  const router = useRouter()

  const [currentStage, setStage] = useState(-1)
  const [cards, setCards] = useState<PaymentCard[]>(null)

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

  let flowContent: ReactElement
  switch (currentStage) {
    // Card selection stage
    case 0:
      flowContent = (
        <CardSelect
          transaction={transaction}
          clientSecret={clientSecret}
          cards={cards}
          submit={() => router.push(successRedirect)}
          skip={() => setStage(1)}
        />
      )
      break
    // Card input stage
    case 1:
      flowContent = <PaymentForm transactionId={transaction.summary.id} />
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
        onClick={() => cancelTransaction(transaction.summary.id)}
      >
        Cancel Transaction
      </Button>
    </div>
  )
}

export default Checkout
