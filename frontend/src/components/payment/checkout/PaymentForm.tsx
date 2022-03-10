import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { FunctionComponent, ReactElement, useState } from 'react'
import { TRANSACTION_SAVE_CARD_URL } from '../../../env'
import Button from '../../Button'
import Spinner from '../../Spinner'
import styles from './PaymentForm.module.scss'

interface Props {
  transactId: string
}

const PaymentForm: FunctionComponent<Props> = ({ transactId }) => {
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
      await fetch(TRANSACTION_SAVE_CARD_URL(transactId), {
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
        return_url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/payment/success`,
      },
    })

    // Redirect will have occurred otherwise
    if (result.error) {
      // TODO
      setProcessing(false)
    }
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
