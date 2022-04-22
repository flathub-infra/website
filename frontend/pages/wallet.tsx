import { GetStaticProps } from 'next'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'
import LoginGuard from '../src/components/login/LoginGuard'
import SavedCards from '../src/components/payment/cards/SavedCards'
import TransactionHistory from '../src/components/payment/transactions/TransactionHistory'
import styles from './userpage.module.scss'

// This is a proof of concept page, ideally this information will be
// integrated into the user page as a tab or similar
export default function Wallet() {
  const { t } = useTranslation()

  return (
    <>
      <NextSeo title={t('user-wallet')} noindex={true} />
      <div className={styles.userArea}>
        <LoginGuard>
          <SavedCards />
          <TransactionHistory />
        </LoginGuard>
      </div>
    </>
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
