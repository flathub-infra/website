import { useStripe } from '@stripe/react-stripe-js'
import { useTranslation } from 'next-i18next'
import { FunctionComponent, ReactElement, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import {
  TRANSACTION_SET_CARD_URL,
  TRANSACTION_SET_PENDING_URL,
} from '../../../env'
import { PaymentCard, TransactionDetailed } from '../../../types/Payment'
import Button from '../../Button'
import Spinner from '../../Spinner'
import CardInfo from '../cards/CardInfo'
import styles from './CardSelect.module.scss'

async function setCard(transactionId: string, card: PaymentCard) {
  let res: Response
  try {
    res = await fetch(TRANSACTION_SET_CARD_URL(transactionId), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(card),
    })
  } catch {
    throw 'network-error-try-again'
  }
  if (res.ok) {
    const data = await res.json()
    return data
  } else {
    throw 'network-error-try-again'
  }
}

async function setPending(txnId: string) {
  let res: Response
  try {
    res = await fetch(TRANSACTION_SET_PENDING_URL(txnId), {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    throw 'network-error-try-again'
  }

  if (!res.ok) {
    throw 'network-error-try-again'
  }
}

interface Props {
  transaction: TransactionDetailed
  clientSecret: string
  cards: PaymentCard[]
  error: string
  submit: () => void
  skip: () => void
}

const CardSelect: FunctionComponent<Props> = ({
  transaction,
  clientSecret,
  cards,
  error,
  submit,
  skip,
}) => {
  const { t } = useTranslation()
  const stripe = useStripe()

  const [confirmed, setConfirmed] = useState(false)
  const [useCard, setUseCard] = useState<PaymentCard>(null)

  // User must confirm card selection so their intent to pay is explicit
  useEffect(() => {
    async function onConfirm() {
      const { id } = transaction.summary

      setCard(id, useCard)
        .then(() => setPending(id))
        .then(async () => {
          const result = await stripe.confirmCardPayment(clientSecret, {
            payment_method: useCard.id,
          })

          if (result.error) {
            switch (result.error.type) {
              // Card error occurs when insufficient funds, etc.
              case 'card_error':
                // https://stripe.com/docs/declines/codes
                if (result.error.decline_code) {
                  throw `stripe-declined-${result.error.decline_code}`
                }

              // Less specific card errors fallback to the error code
              case 'invalid_request_error':
                // https://stripe.com/docs/error-codes
                throw `stripe-error-${result.error.code}`
              case 'api_error':
                throw 'stripe-api-error'
              default:
                throw 'network-error-try-again'
            }
          } else {
            submit()
          }
        })
        .catch((err) => {
          toast.error(t(err))
          setConfirmed(false)
        })
    }

    // Payment confirmation can only occur once a card is selected
    if (confirmed && !useCard) {
      setConfirmed(false)
    }

    if (stripe && useCard && confirmed) {
      onConfirm()
    }
  }, [transaction, confirmed, clientSecret, cards, submit, stripe, useCard, t])

  let cardSection: ReactElement
  if (error) {
    cardSection = <p>{t(error)}</p>
  } else if (cards) {
    const cardElems = cards.map((card) => {
      return (
        <CardInfo
          key={card.id}
          card={card}
          onClick={() => setUseCard(card)}
          className={useCard && card.id === useCard.id ? styles.selected : ''}
        />
      )
    })

    cardSection = <div className={styles.cardList}>{cardElems}</div>
  } else {
    cardSection = (
      <Spinner size={100} text={t('loading-saved-payment-methods')} />
    )
  }

  // Should always present the option to use a new card in case user
  // doesn't want to wait for a slow network
  return (
    <div className='main-container'>
      <h3>{t('saved-cards')}</h3>
      {cardSection}
      <div style={{ display: 'flex', gap: '12px' }}>
        <Button onClick={skip}>{t('use-new-card')}</Button>
        <Button onClick={() => setConfirmed(true)} disabled={!useCard}>
          {t('confirm-selection')}
        </Button>
      </div>
    </div>
  )
}

export default CardSelect
