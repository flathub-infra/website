import { useTranslation } from 'next-i18next'
import { FunctionComponent, useEffect, useState } from 'react'
import { useUserContext } from '../../../context/user-info'
import { TRANSACTIONS_URL } from '../../../env'
import { Transaction } from '../../../types/Payment'
import Spinner from '../../Spinner'
import TransactionList from './TransactionList'

async function getTransactions(
  setTransactions,
  sort: string = 'recent',
  limit: number = 30,
  since?: string
) {
  const url = new URL(TRANSACTIONS_URL)
  url.searchParams.append('sort', sort)
  url.searchParams.append('limit', limit.toString())
  if (since) {
    url.searchParams.append('since', since)
  }

  const res = await fetch(url.href, { credentials: 'include' })
  const data = await res.json()

  // TODO will need to append to existing data
  setTransactions(data)
}

const TransactionHistory: FunctionComponent = () => {
  const { t } = useTranslation()
  const user = useUserContext()

  const [page, setPage] = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>(null)

  // More transactions should be queried when user requests
  useEffect(() => {
    if (user.info) {
      // TODO: Handle page traversal
      getTransactions(setTransactions)
    }
  }, [user, page])

  // Nothing to show if not logged in
  if (!user.info) {
    return <></>
  }

  if (!transactions) {
    return <Spinner size={100} text={t('loading')} />
  }

  return (
    <div className='main-container'>
      <h3>{t('transaction-history')}</h3>
      <TransactionList transactions={transactions} />
    </div>
  )
}

export default TransactionHistory
