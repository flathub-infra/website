import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useTranslation } from 'next-i18next'
import { FormEvent, FunctionComponent, useState } from 'react'
import { toast } from 'react-toastify'
import {
  TRANSACTION_SAVE_CARD_URL,
  TRANSACTION_SET_PENDING_URL,
} from '../../../env'
import Button from '../../Button'
import Spinner from '../../Spinner'
import styles from './PaymentForm.module.scss'

async function saveCard(transactionId: string) {
  let res: Response
  try {
    res = await fetch(TRANSACTION_SAVE_CARD_URL(transactionId), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ save_card: 'on_session' }),
    })
  } catch {
    throw 'network-error-try-again'
  }

  if (!res.ok) {
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
  transactionId: string
  callbackPage: string
}

const PaymentForm: FunctionComponent<Props> = ({
  transactionId,
  callbackPage,
}) => {
  const { t } = useTranslation()
  const stripe = useStripe()
  const elements = useElements()

  // UI control state
  const [checked, setChecked] = useState(false)
  const [processing, setProcessing] = useState(false)

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <PaymentElement />
      {processing ? (
        <Spinner size={50} />
      ) : (
        <>
          <div>
            <input
              id='save-card'
              type='checkbox'
              checked={checked}
              onChange={() => setChecked(!checked)}
            />
            <label htmlFor='save-card'>{t('save-card-for-reuse')}</label>
          </div>
          <Button>{t('submit-payment')}</Button>
        </>
      )}
    </form>
  )

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    // Can't submit when Stripe isn't ready
    if (!stripe || !elements) {
      return
    }

    submit().catch((err) => {
      toast.error(t(err))
      setProcessing(false)
    })
  }

  async function submit() {
    setProcessing(true)

    if (checked) {
      await saveCard(transactionId)
    }

    await setPending(transactionId)

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: callbackPage,
      },
    })

    // Redirect will have occurred otherwise
    if (result.error) {
      switch (result.error.type) {
        case 'card_error':
          // https://stripe.com/docs/declines/codes
          if (result.error.decline_code) {
            // Lost and stolen cards should be presented as a generic decline
            // https://stripe.com/docs/declines/codes#lost_card
            if (
              ['lost_card', 'stolen_card'].includes(result.error.decline_code)
            ) {
              throw 'stripe-declined-generic_decline'
            }

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
    }
  }
}

export default PaymentForm
