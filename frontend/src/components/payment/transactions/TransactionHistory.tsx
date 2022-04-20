import { useTranslation } from 'next-i18next'
import { FunctionComponent, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useUserContext } from '../../../context/user-info'
import { TRANSACTIONS_URL } from '../../../env'
import { Transaction } from '../../../types/Payment'
import Button from '../../Button'
import Spinner from '../../Spinner'
import TransactionList from './TransactionList'
import styles from './TransactionHistory.module.scss'

async function getTransactions(
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

  let res: Response
  try {
    res = await fetch(url.href, { credentials: 'include' })
  } catch {
    throw 'failed-to-load-refresh'
  }

  if (res.ok) {
    // Not checking status, server only complains if not logged in (which we enforce)
    const data = await res.json()
    return data
  } else {
    throw 'failed-to-load-refresh'
  }
}

const perPage = 10

const TransactionHistory: FunctionComponent = () => {
  const { t } = useTranslation()
  const user = useUserContext()

  // Total count of transactions unknown, end determined when encountered
  const [page, setPage] = useState(0)
  const [endPage, setEndPage] = useState<number>(null)
  const [transactions, setTransactions] = useState<Transaction[]>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    function addNewPage(newPage: Transaction[]) {
      // Upon reaching no more transactions, stop traversing
      if (newPage.length === 0) {
        setEndPage(page - 1)
        setPage(page - 1)
        toast.info(t('no-more-transactions'))
      } else {
        setTransactions([...(transactions ?? []), ...newPage])
      }
    }

    // Can only traverse in sequence, so new page always past end of array
    function isNewPage() {
      return (transactions ?? []).length <= page * perPage
    }

    if (user.info && isNewPage()) {
      if (page > 0) {
        const since = transactions.at(-1)
        getTransactions('recent', perPage, since.id)
          .then(addNewPage)
          .catch(setError)
      } else {
        getTransactions('recent', perPage).then(addNewPage).catch(setError)
      }
    }
  }, [user, page, transactions, t])

  // Nothing to show if not logged in
  if (!user.info) {
    return <></>
  }

  if (!transactions && !error) {
    return <Spinner size={100} text={t('loading')} />
  }

  return (
    <div className='main-container'>
      <h3>{t('transaction-history')}</h3>
      {error ? (
        <p>{t(error)}</p>
      ) : (
        <>
          <TransactionList
            transactions={transactions.slice(
              page * perPage,
              page * perPage + perPage
            )}
          />
          <div className={styles.controlPage}>
            <Button
              type='secondary'
              onClick={() => setPage(0)}
              disabled={page === 0}
            >
              {t('first-page')}
            </Button>
            <Button type='secondary' onClick={pageBack} disabled={page === 0}>
              {t('previous-page')}
            </Button>
            <Button
              type='secondary'
              onClick={pageForward}
              disabled={page === endPage}
            >
              {t('next-page')}
            </Button>
          </div>
        </>
      )}
    </div>
  )

  function pageForward() {
    setPage(Math.min(page + 1, endPage ?? page + 1))
  }

  function pageBack() {
    setPage(Math.max(0, page - 1))
  }
}

export default TransactionHistory
