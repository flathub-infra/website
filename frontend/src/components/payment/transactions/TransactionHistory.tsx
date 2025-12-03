import { useTranslations } from "next-intl"
import { FunctionComponent, useEffect, useState, useRef } from "react"

import { toast } from "sonner"
import { useUserContext } from "../../../context/user-info"
import Spinner from "../../Spinner"
import { TransactionSummary } from "src/codegen/model/transactionSummary"
import { getTransactionsWalletTransactionsGet } from "src/codegen"
import { TransactionHistoryTable } from "./TransactionHistoryTable"
import { ClockIcon } from "@heroicons/react/24/outline"

const perPage = 10

const TransactionHistory: FunctionComponent = () => {
  const t = useTranslations()
  const user = useUserContext()

  // Total count of transactions unknown, end determined when encountered
  const [page, setPage] = useState(0)
  const [endPage, setEndPage] = useState<number>(null)

  const [transactions, setTransactions] = useState<TransactionSummary[]>(null)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const fetchedPagesRef = useRef<Set<number>>(new Set())
  const lastTxnIdRef = useRef<string | null>(null)
  const userInviteCodeRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user.info || user.loading) {
      return
    }

    if (userInviteCodeRef.current !== user.info.invite_code) {
      userInviteCodeRef.current = user.info.invite_code
      fetchedPagesRef.current = new Set()
      lastTxnIdRef.current = null
      setTransactions(null)
      setPage(0)
      setEndPage(null)
      setError("")
      setIsLoading(false)
      return
    }

    if (isLoading || fetchedPagesRef.current.has(page)) {
      return
    }

    fetchedPagesRef.current.add(page)
    setIsLoading(true)

    const since = page > 0 ? lastTxnIdRef.current : null

    getTransactionsWalletTransactionsGet(
      {
        sort: "recent",
        since,
        limit: perPage,
      },
      {
        withCredentials: true,
      },
    )
      .then((response) => {
        if (page > 0 && response.data.length === 0) {
          setEndPage(page - 1)
          setPage(page - 1)
          fetchedPagesRef.current.delete(page)
          toast.info(t("no-more-transactions"))
        } else {
          if (response.data.length > 0) {
            lastTxnIdRef.current = response.data[response.data.length - 1].id
          }
          setTransactions((prev) => [...(prev ?? []), ...response.data])
        }
      })
      .catch((err) => {
        setError(err.message || String(err))
        fetchedPagesRef.current.delete(page)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [user.info, user.loading, page, isLoading, t])

  // Nothing to show if not logged in or still loading user
  if (!user.info || user.loading) {
    return <></>
  }

  if (!transactions && !error) {
    return (
      <div className="rounded-2xl bg-flathub-white p-6 shadow-lg dark:bg-flathub-arsenic/80 border border-flathub-gainsborow/30 dark:border-flathub-granite-gray/20">
        <div className="flex items-center gap-3 mb-4">
          <ClockIcon className="size-6 text-flathub-celestial-blue" />
          <h3 className="text-xl font-semibold">{t("transaction-history")}</h3>
        </div>
        <Spinner size="m" text={t("loading")} />
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-flathub-white p-6 shadow-lg dark:bg-flathub-arsenic/80 border border-flathub-gainsborow/30 dark:border-flathub-granite-gray/20">
      <div className="flex items-center gap-3 mb-4">
        <ClockIcon className="size-6 text-flathub-celestial-blue" />
        <h3 className="text-xl font-semibold">{t("transaction-history")}</h3>
      </div>
      {error ? (
        <p className="text-flathub-sonic-silver dark:text-flathub-spanish-gray">
          {t(error)}
        </p>
      ) : (
        <TransactionHistoryTable
          transactions={transactions}
          perPage={perPage}
          error={error}
          page={page}
          endPage={endPage}
          setPage={setPage}
        />
      )}
    </div>
  )
}

export default TransactionHistory
