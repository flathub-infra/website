import { i18n, useTranslation } from "next-i18next"
import { FunctionComponent, useEffect, useState } from "react"
import {
  HiChevronLeft,
  HiChevronRight,
  HiExclamationTriangle,
} from "react-icons/hi2"
import { toast } from "react-toastify"
import { useUserContext } from "../../../context/user-info"
import Spinner from "../../Spinner"
import { formatCurrency } from "src/utils/localize"
import { clsx } from "clsx"
import { AxiosResponse } from "axios"
import { TransactionSummary } from "src/codegen/model/transactionSummary"
import { getTransactionsWalletTransactionsGet } from "src/codegen"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { UTCDate } from "@date-fns/utc"
import { format } from "date-fns"
import router from "next/router"

const perPage = 10

const TransactionHistory: FunctionComponent = () => {
  const { t } = useTranslation()
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

  const pageSlice = error
    ? []
    : transactions.slice(page * perPage, page * perPage + perPage)

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <h3 className="my-4 text-xl font-semibold">{t("transaction-history")}</h3>
      {error ? (
        <p>{t(error)}</p>
      ) : (
        <div className="flex flex-col gap-3 w-full lg:max-w-6xl">
          {transactions.length === 0 && <p>{t("no-transactions")}</p>}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{t("created")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageSlice.map((entry) => {
                const needsAttention = ["new", "retry"].includes(entry.status)
                return (
                  <TableRow
                    key={entry.id}
                    onClick={() => router.push(`/payment/details/${entry.id}`)}
                    className="cursor-pointer"
                  >
                    <TableCell>{t(`kind-${entry.kind}`)}</TableCell>
                    <TableCell>
                      {format(new UTCDate(entry.created * 1000), "Pp")}
                    </TableCell>
                    <TableCell>{t(`status-${entry.status}`)}</TableCell>
                    <TableCell className="text-right flex justify-end gap-1 items-center">
                      {needsAttention && (
                        <HiExclamationTriangle className="text-red-500" />
                      )}
                      <span
                        className={clsx(
                          entry.status === "cancelled" && "line-through",
                        )}
                      >
                        {formatCurrency(
                          entry.value / 100,
                          i18n.language,
                          entry.currency,
                        )}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {transactions.length > 0 && (
            <div className="flex justify-center gap-5 pt-4">
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
          )}
        </div>
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
