import { useRouter } from 'next/router'
import { FunctionComponent, ReactElement, useEffect, useState } from 'react'
import { WALLET_INFO_URL } from '../../../env'
import { PaymentCard, TransactionDetailed } from '../../../types/Payment'
import Spinner from '../../Spinner'
import TransactionCancelButton from '../transactions/TransactionCancelButton'
import CardSelect from './CardSelect'
import styles from './Checkout.module.scss'
import PaymentForm from './PaymentForm'

async function getCards() {
  // TODO: Error handling
  const res = await fetch(WALLET_INFO_URL, { credentials: 'include' })
  const data = await res.json()
  return data.cards
}

interface Props {
  transaction: TransactionDetailed
  clientSecret: string
}

enum Stage {
  Loading,
  CardSelect,
  CardInput,
}

const detailsPage = `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/payment/details`

const Checkout: FunctionComponent<Props> = ({ transaction, clientSecret }) => {
  const router = useRouter()

  const [currentStage, setStage] = useState(Stage.Loading)
  const [cards, setCards] = useState<PaymentCard[]>(null)

  const { id: txnId } = transaction.summary

  // Cards should only be retrieved once
  useEffect(() => {
    getCards().then((data) => {
      // User may have no saved cards to select from
      if (data.length) {
        setCards(data)
        setStage(Stage.CardSelect)
      } else {
        setStage(Stage.CardInput)
      }
    })
  }, [])

  let flowContent: ReactElement
  switch (currentStage) {
    case Stage.CardSelect:
      flowContent = (
        <CardSelect
          transaction={transaction}
          clientSecret={clientSecret}
          cards={cards}
          submit={() => router.push(`${detailsPage}/${txnId}`)}
          skip={() => setStage(Stage.CardInput)}
        />
      )
      break
    case Stage.CardInput:
      flowContent = (
        <PaymentForm
          transactionId={txnId}
          callbackPage={`${detailsPage}/${txnId}`}
        />
      )
      break
    // Loading is a safe default rendering
    default:
      flowContent = <Spinner size={100} />
  }

  return (
    <div className='main-container'>
      <div className={styles.checkout}>
        {flowContent}
        <TransactionCancelButton
          id={txnId}
          onSuccess={() => router.push(`${detailsPage}/${txnId}`)}
        />
      </div>
    </div>
  )
}

export default Checkout
