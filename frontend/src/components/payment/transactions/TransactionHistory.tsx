import { useTranslation } from "next-i18next"
import { Dispatch, FunctionComponent, useEffect, useState } from "react"
import {
  HiChevronLeft,
  HiChevronRight,
  HiExclamationTriangle,
} from "react-icons/hi2"
import { toast } from "react-toastify"
import { getTransactions } from "../../../asyncs/payment"
import { useUserContext } from "../../../context/user-info"
import {
  Transaction,
  TransactionDetailed,
  TransactionStatus,
} from "../../../types/Payment"
import Button from "../../Button"
import Spinner from "../../Spinner"
import { FlathubDisclosure } from "./../../Disclosure"
import { getIntlLocale } from "src/localize"
import { formatCurrency } from "src/utils/localize"
import { classNames } from "src/styling"
import ButtonLink from "src/components/ButtonLink"
import TransactionCancelButton from "./TransactionCancelButton"
import { TRANSACTION_INFO_URL } from "src/env"

const perPage = 10

const TransactionPanel = ({
  transaction,
  needsAttention,
  setStatus,
}: {
  transaction: Transaction
  needsAttention: boolean
  setStatus: Dispatch<TransactionStatus>
}) => {
  const { t } = useTranslation()

  const [transactionDetailed, setTransactionDetailed] =
    useState<TransactionDetailed>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    getTransaction(transaction.id).then(setTransactionDetailed).catch(setError)
  }, [transaction.id])

  async function getTransaction(transactionId: string) {
    let res: Response
    try {
      res = await fetch(TRANSACTION_INFO_URL(transactionId), {
        credentials: "include",
      })
    } catch {
      throw "failed-to-load-refresh"
    }

    if (res.ok) {
      return await res.json()
    } else {
      throw "failed-to-load-refresh"
    }
  }

  if (transactionDetailed == null && !error) {
    return (
      <div className="flex flex-col gap-3 rounded-xl bg-flathub-white p-3 shadow-md dark:bg-flathub-arsenic">
        <Spinner size="m" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-flathub-white p-3 shadow-md dark:bg-flathub-arsenic">
      {error && (
        <>
          <h1 className="my-8">{t("whoops")}</h1>
          <p>{t(error)}</p>
        </>
      )}
      {!error && needsAttention && (
        <div className="flex gap-3">
          <ButtonLink
            href={`/payment/${transaction.id}`}
            passHref
            variant="primary"
            className="w-full md:w-auto"
          >
            {t("retry-checkout")}
          </ButtonLink>
          <TransactionCancelButton
            id={transaction.id}
            onSuccess={() => setStatus("cancelled")}
            className="w-full md:w-auto"
          />
        </div>
      )}
      {!error && transactionDetailed && (
        <div className="flex flex-col gap-1">
          {transactionDetailed.details.map((entry, i) => {
            return <span key={entry.recipient}>{entry.recipient}</span>
          })}
          {transactionDetailed.receipt ? (
            <a
              href={transactionDetailed.receipt}
              target="_blank"
              rel="noreferrer"
            >
              {t("stripe-receipt")}
            </a>
          ) : (
            <></>
          )}
        </div>
      )}
    </div>
  )
}

const TransactionDisclosure = ({
  transaction,
}: {
  transaction: Transaction
}) => {
  const [shownStatus, setStatus] = useState<TransactionStatus>(
    transaction.status,
  )
  const needsAttention = ["new", "retry"].includes(shownStatus)
  return (
    <FlathubDisclosure
      buttonItems={
        <TransactionHeader
          transaction={transaction}
          needsAttention={needsAttention}
        />
      }
    >
      <TransactionPanel
        needsAttention={needsAttention}
        setStatus={setStatus}
        transaction={transaction}
      />
    </FlathubDisclosure>
  )
}

const TransactionHeader = ({
  transaction,
  needsAttention,
}: {
  transaction: Transaction
  needsAttention: boolean
}) => {
  const { t, i18n } = useTranslation()

  const { created, updated, kind, value, status } = transaction

  // Status may change through interaction
  const [shownStatus, setStatus] = useState(status)

  // Date object expects milliseconds since epoch
  const prettyUpdated = new Date(updated * 1000).toLocaleDateString(
    getIntlLocale(i18n.language),
    {
      month: "numeric",
      day: "numeric",
    },
  )
  const prettyValue = formatCurrency(value / 100, i18n.language)

  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex items-center justify-between">
        <div>{t(`kind-${kind}`)}</div>

        <div className="flex items-center gap-2">
          {needsAttention && <HiExclamationTriangle className="text-red-500" />}
          <span
            className={classNames(status === "cancelled" && "line-through")}
          >
            {prettyValue}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 text-sm font-medium">
        <div>{prettyUpdated}</div>
        <div>{t(`status-${shownStatus}`)}</div>
      </div>
    </div>
  )
}

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

  let currentYear = null

  return (
    <div className="max-w-11/12 my-0 mx-auto w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <h3>{t("transaction-history")}</h3>
      {error ? (
        <p>{t(error)}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {transactions.length === 0 && <p>{t("no-transactions")}</p>}

          {pageSlice.map((transaction) => {
            const currentYearChanged =
              currentYear !== new Date(transaction.created * 1000).getFullYear()
            currentYear = new Date(transaction.created * 1000).getFullYear()

            return (
              <>
                {currentYearChanged && (
                  <div className="pt-4 font-bold first:pt-0">
                    {new Date(transaction.created * 1000).getFullYear()}
                  </div>
                )}
                <TransactionDisclosure
                  key={transaction.id}
                  transaction={transaction}
                />
              </>
            )
          })}
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
