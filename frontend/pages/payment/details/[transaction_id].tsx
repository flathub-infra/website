import { GetStaticPaths, GetStaticProps } from 'next'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ReactElement, useEffect, useState } from 'react'
import Button from '../../../src/components/Button'
import Main from '../../../src/components/layout/Main'
import TransactionCancelButton from '../../../src/components/payment/transactions/TransactionCancelButton'
import TransactionDetails from '../../../src/components/payment/transactions/TransactionDetails'
import Spinner from '../../../src/components/Spinner'
import { useUserContext } from '../../../src/context/user-info'
import { TRANSACTION_INFO_URL } from '../../../src/env'
import { TransactionDetailed } from '../../../src/types/Payment'

async function getTransaction(txnId: string) {
  const res = await fetch(TRANSACTION_INFO_URL(txnId), {
    credentials: 'include',
  })

  if (res.ok) {
    return await res.json()
  } else {
    // TODO
  }
}

export default function TransactionPage() {
  const { t } = useTranslation()

  // Must access query params to POST to backend for oauth verification
  const router = useRouter()

  const [transaction, setTransaction] = useState<TransactionDetailed>(null)

  const user = useUserContext()

  // Once router is ready the transaction ID is attainable
  useEffect(() => {
    // Must be logged in to see payment confirmation
    if (!user.info && !user.loading) {
      router.push('/login')
    }

    // Router must be ready to access query parameters
    if (!router.isReady) {
      return
    }

    // Once the transaction ID is known, the associated data can be fetched
    const { transaction_id } = router.query

    if (Array.isArray(transaction_id)) {
      // TODO: Handle this, guessing happens if user navigates to deep dynamic route
      return
    }

    getTransaction(transaction_id).then((transaction) =>
      setTransaction(transaction)
    )
  }, [router, user])

  let content: ReactElement = <Spinner size={200} />
  if (transaction) {
    const unresolved = ['new', 'retry'].includes(transaction.summary.status)
    if (unresolved) {
      content = (
        <>
          <h3>Oops! Something went wrong with this transaction.</h3>
          <TransactionCancelButton
            id={transaction.summary.id}
            onSuccess={() => router.reload()}
          />
          <Link href={`/payment/${transaction.summary.id}`} passHref>
            <Button>Retry checkout</Button>
          </Link>
        </>
      )
    } else {
      content = <TransactionDetails transaction={transaction} />
    }
  }

  return (
    <Main>
      <NextSeo title={t('payment-summary')} noindex={true}></NextSeo>
      <div className='main-container'>{content}</div>
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
