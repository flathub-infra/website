import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useTranslation } from 'next-i18next'
import { FormEvent, FunctionComponent, useState } from 'react'
import { TRANSACTION_SAVE_CARD_URL } from '../../../env'
import Button from '../../Button'
import Spinner from '../../Spinner'
import styles from './PaymentForm.module.scss'

async function saveCard(transactionId: string) {
  await fetch(TRANSACTION_SAVE_CARD_URL(transactionId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ save_card: 'on_session' }),
  })
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    if (!stripe || !elements) {
      // Load hasn't completed yet
      return
    }

    setProcessing(true)

    if (checked) {
      saveCard(transactionId)
    }

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: callbackPage,
      },
    })

    // Redirect will have occurred otherwise
    if (result.error) {
      // TODO
      setProcessing(false)
    }
  }
}

export default PaymentForm
