import { useTranslations } from "next-intl"
import { FunctionComponent, useEffect, useState } from "react"

import { toast } from "sonner"
import { useUserContext } from "../../../context/user-info"
import Spinner from "../../Spinner"
import { AxiosResponse } from "axios"
import { TransactionSummary } from "src/codegen/model/transactionSummary"
import { getTransactionsWalletTransactionsGet } from "src/codegen"
import { TransactionHistoryTable } from "./TransactionHistoryTable"

const perPage = 10

const TransactionHistory: FunctionComponent = () => {
  const t = useTranslations()
  const user = useUserContext()

  // Total count of transactions unknown, end determined when encountered
  const [page, setPage] = useState(0)
  const [endPage, setEndPage] = useState<number>(null)

  const [transactions, setTransactions] = useState<TransactionSummary[]>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    function addNewPage(newPage: AxiosResponse<TransactionSummary[], any>) {
      // Upon reaching no more transactions, stop traversing
      if (page > 0 && newPage.data.length === 0) {
        setEndPage(page - 1)
        setPage(page - 1)
        toast.info(t("no-more-transactions"))
      } else {
        setTransactions([...(transactions ?? []), ...newPage.data])
      }
    }

    // Can only traverse in sequence, so new page always past end of array
    function isNewPage() {
      return (transactions ?? []).length <= page * perPage
    }

    if (user.info && isNewPage()) {
      const since = transactions?.at(-1)
      getTransactionsWalletTransactionsGet(
        {
          sort: "recent",
          since: page > 0 ? since.id : null,
          limit: perPage,
        },
        {
          withCredentials: true,
        },
      )
        .then(addNewPage)
        .catch(setError)
    }
  }, [user, page, transactions, t])

  // Nothing to show if not logged in
  if (!user.info) {
    return <></>
  }

  if (!transactions && !error) {
    return <Spinner size="m" text={t("loading")} />
  }

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <h3 className="my-4 text-xl font-semibold">{t("transaction-history")}</h3>
      {error ? (
        <p>{t(error)}</p>
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
