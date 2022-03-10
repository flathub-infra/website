import { GetStaticProps } from 'next'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'
import Router from 'next/router'
import { ReactElement, useEffect } from 'react'
import Main from '../src/components/layout/Main'
import SavedCards from '../src/components/payment/cards/SavedCards'
import DonationInput from '../src/components/payment/DonationInput'
import TransactionHistory from '../src/components/payment/transactions/TransactionHistory'
import Spinner from '../src/components/Spinner'
import { useUserContext } from '../src/context/user-info'
import styles from './userpage.module.scss'

// This is a proof of concept page, ideally this information will be
// integrated into the user page as a tab or similar
export default function Wallet() {
  const { t } = useTranslation()
  const user = useUserContext()

  // Nothing to show if not logged in, return to home
  useEffect(() => {
    if (!user.info && !user.loading) {
      Router.push('/')
    }
  }, [user])

  let content: ReactElement
  if (user.loading || !user.info) {
    content = <Spinner size={150} />
  } else {
    content = (
      <div className={styles.userArea}>
        <SavedCards />
        <TransactionHistory />
        <DonationInput />
      </div>
    )
  }

  return (
    <Main>
      <NextSeo title={t('user-wallet')} noindex={true} />
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
