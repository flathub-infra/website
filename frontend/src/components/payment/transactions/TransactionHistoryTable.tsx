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

import { formatCurrency } from "src/utils/localize"
import { clsx } from "clsx"
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid"
import { ExclamationTriangleIcon } from "@heroicons/react/16/solid"
import { useLocale, useTranslations } from "next-intl"
import { TransactionSummary } from "src/codegen"
import { Dispatch, SetStateAction } from "react"
import { getIntlLocale } from "src/localize"
import { useRouter } from "src/i18n/navigation"

export const TransactionHistoryTable = ({
  transactions,
  perPage,
  error,
  page,
  endPage,
  setPage,
}: {
  transactions: TransactionSummary[]
  perPage: number
  error: string
  page: number
  endPage: number
  setPage: Dispatch<SetStateAction<number>>
}) => {
  const t = useTranslations()
  const locale = useLocale()
  const i18n = getIntlLocale(locale)
  const router = useRouter()

  function pageForward() {
    setPage(Math.min(page + 1, endPage ?? page + 1))
  }

  function pageBack() {
    setPage(Math.max(0, page - 1))
  }

  const pageSlice = error
    ? []
    : transactions.slice(page * perPage, page * perPage + perPage)

  return (
    <div className="flex flex-col gap-3 w-full">
      {transactions.length === 0 && (
        <p className="text-flathub-sonic-silver dark:text-flathub-spanish-gray">
          {t("no-transactions")}
        </p>
      )}

      {transactions.length > 0 && (
        <>
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
                        <ExclamationTriangleIcon className="text-red-500 size-4" />
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
          <div className="flex justify-center gap-5 pt-4">
            <Button
              variant="secondary"
              onClick={pageBack}
              disabled={page === 0}
              aria-label={t("previous-page")}
            >
              <ChevronLeftIcon className="text-2xl size-6" />
            </Button>
            <Button
              variant="secondary"
              onClick={pageForward}
              disabled={page === endPage || perPage > pageSlice.length}
              aria-label={t("next-page")}
            >
              <ChevronRightIcon className="text-2xl size-6" />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
