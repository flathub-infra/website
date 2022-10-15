import { useTranslation } from "next-i18next"
import { FunctionComponent, useEffect, useState } from "react"
import { HiChevronLeft, HiChevronRight } from "react-icons/hi2"
import { toast } from "react-toastify"
import { getTransactions } from "../../../asyncs/payment"
import { useUserContext } from "../../../context/user-info"
import { Transaction } from "../../../types/Payment"
import Button from "../../Button"
import Spinner from "../../Spinner"
import TransactionList from "./TransactionList"

const perPage = 10

const TransactionHistory: FunctionComponent = () => {
  const { t } = useTranslation()
  const user = useUserContext()

  // Total count of transactions unknown, end determined when encountered
  const [page, setPage] = useState(0)
  const [endPage, setEndPage] = useState<number>(null)
  const [transactions, setTransactions] = useState<Transaction[]>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    function addNewPage(newPage: Transaction[]) {
      // Upon reaching no more transactions, stop traversing
      if (page > 0 && newPage.length === 0) {
        setEndPage(page - 1)
        setPage(page - 1)
        toast.info(t("no-more-transactions"))
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
        getTransactions("recent", perPage, since.id)
          .then(addNewPage)
          .catch(setError)
      } else {
        // Fetch the first page only if we've not tried before, otherwise if
        // the user has no transactions we keep re-fetching.
        if (page == 0 && transactions === null) {
          getTransactions("recent", perPage).then(addNewPage).catch(setError)
        }
      }
    }
  }, [user, page, transactions, t])

  // Nothing to show if not logged in
  if (!user.info) {
    return <></>
  }

  if (!transactions && !error) {
    return <Spinner size="m" text={t("loading")} />
  }

  const pageSlice = error
    ? []
    : transactions.slice(page * perPage, page * perPage + perPage)

  return (
    <div className="max-w-11/12 my-0 mx-auto w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <h3>{t("transaction-history")}</h3>
      {error ? (
        <p>{t(error)}</p>
      ) : (
        <>
          <TransactionList transactions={pageSlice} />
          <div className="flex justify-center gap-5">
            <Button
              variant="secondary"
              onClick={pageBack}
              disabled={page === 0}
              aria-label={t("previous-page")}
            >
              <HiChevronLeft className="text-2xl" />
            </Button>
            <Button
              variant="secondary"
              onClick={pageForward}
              disabled={page === endPage || perPage > pageSlice.length}
              aria-label={t("next-page")}
            >
              <HiChevronRight className="text-2xl" />
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
