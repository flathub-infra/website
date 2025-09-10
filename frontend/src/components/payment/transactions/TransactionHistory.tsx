import { useTranslations } from "next-intl"
import { FunctionComponent, useState } from "react"

import { toast } from "sonner"
import { useUserContext } from "../../../context/user-info"
import Spinner from "../../Spinner"
import { TransactionSummary } from "src/codegen/model/transactionSummary"
import { useGetTransactionsWalletTransactionsGet } from "src/codegen"
import { TransactionHistoryTable } from "./TransactionHistoryTable"

const perPage = 10

const TransactionHistory: FunctionComponent = () => {
  const t = useTranslations()
  const user = useUserContext()

  // Total count of transactions unknown, end determined when encountered
  const [page, setPage] = useState(0)
  const [endPage, setEndPage] = useState<number>(null)

  const [since, setSince] = useState<TransactionSummary>(null)

  const query = useGetTransactionsWalletTransactionsGet(
    {
      sort: "recent",
      since: page > 0 ? since.id : null,
      limit: perPage,
    },
    {
      query: {
        enabled: !!user.info,
      },
      fetch: {
        credentials: "include",
      },
    },
  )

  // Nothing to show if not logged in
  if (query?.data?.status !== 200) {
    return null
  }

  if (query.isLoading) {
    return <Spinner size="m" text={t("loading")} />
  }

  if (query.isError) {
    return (
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <h3 className="my-4 text-xl font-semibold">
          {t("transaction-history")}
        </h3>
        <p>{t(query.error.detail.toString())}</p>
      </div>
    )
  }

  query.data

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <h3 className="my-4 text-xl font-semibold">{t("transaction-history")}</h3>
      <TransactionHistoryTable
        transactions={query?.data?.data}
        perPage={perPage}
        page={page}
        endPage={endPage}
        setPage={setPage}
      />
    </div>
  )
}

export default TransactionHistory
