import { Elements } from '@stripe/react-stripe-js'
import { loadStripe, Stripe } from '@stripe/stripe-js'
import { GetStaticPaths, GetStaticProps } from 'next'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'
import { useRouter } from 'next/router'
import { ReactElement, useEffect, useState } from 'react'
import Main from '../../src/components/layout/Main'
import PaymentForm from '../../src/components/payment/checkout/PaymentForm'
import Spinner from '../../src/components/Spinner'
import { useUserContext } from '../../src/context/user-info'
import {
  STRIPE_DATA_URL,
  TRANSACTION_INFO_URL,
  TRANSACTION_STRIPE_INFO_URL,
} from '../../src/env'

// Memoized Stripe object retrieval so it's only retrieved on demand
let stripePromise: Promise<Stripe>
async function getStripeObject(setStripe) {
  if (!stripePromise) {
    // TODO: Error handling
    const stripedata = await (await fetch(STRIPE_DATA_URL)).json()
    if (stripedata.status == 'ok') {
      stripePromise = loadStripe(stripedata.public_key)
      setStripe(stripePromise)
    }
  } else {
    setStripe(stripePromise)
  }
}

// TODO tidy and error handling
async function getTransaction(tid: string) {
  const txndata = await (
    await fetch(TRANSACTION_INFO_URL(tid), { credentials: 'include' })
  ).json()
  let stripedata = { client_secret: null }
  if (txndata.summary.status == 'new' || txndata.summary.status == 'retry') {
    stripedata = await (
      await fetch(TRANSACTION_STRIPE_INFO_URL(tid), { credentials: 'include' })
    ).json()
  }
  return { txn: txndata, clientSecret: stripedata.client_secret }
}

export default function TransactionPage() {
  const { t } = useTranslation()

  // Must access query params to POST to backend for oauth verification
  const router = useRouter()

  const [stripe, setStripe] = useState<Stripe>(null)
  const [transaction, setTransaction] = useState(null)

  const user = useUserContext()

  // Fetch the stripe object only on page mount
  useEffect(() => {
    getStripeObject(setStripe)
  }, [])

  // Once router is ready the transaction ID is attainable
  useEffect(() => {
    // Must be logged in to make a payment
    if (!user.info && !user.loading) {
      router.push('/login')
    }

    // Router must be ready to access query parameters
    if (!router.isReady) {
      return
    }

    // Once the transaction ID is known, the client secret is fetched
    const { transaction_id } = router.query

    if (Array.isArray(transaction_id)) {
      // TODO: Handle this, guessing happens if user navigates to deep dynamic route
      return
    }

    getTransaction(transaction_id).then((data) => setTransaction(data))
  }, [router, user])

  let content: ReactElement
  if (transaction) {
    const options = { clientSecret: transaction.clientSecret }

    content = (
      <Elements stripe={stripe} options={options}>
        <PaymentForm transaction={transaction} />
      </Elements>
    )
  } else {
    content = <Spinner size={200} />
  }

  return (
    <Main>
      <NextSeo title={t('payment')} noindex={true}></NextSeo>
      {content}
    </Main>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common'])),
    },
    revalidate: 3600,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: 'blocking',
  }
}
