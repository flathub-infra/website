import { useLocale, useTranslations } from "next-intl"
import { FunctionComponent } from "react"
import { formatCurrency } from "../../../utils/localize"
import { format } from "date-fns"
import { getDateFnsLocale } from "../../../localize"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { UTCDate } from "@date-fns/utc"
import { Transaction } from "src/codegen"
import TransactionCancelButton from "./TransactionCancelButton"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Link, useRouter } from "src/i18n/navigation"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react"

interface Props {
  transaction: Transaction
}

const TransactionStatusBadge = ({ status }: { status: string }) => {
  const t = useTranslations()

  const statusConfig = {
    success: {
      variant: "default" as const,
      icon: CheckCircle2,
      className:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
    },
    cancelled: {
      variant: "secondary" as const,
      icon: XCircle,
      className:
        "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
    },
    pending: {
      variant: "default" as const,
      icon: Clock,
      className:
        "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
    },
    new: {
      variant: "default" as const,
      icon: AlertCircle,
      className:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
    },
    retry: {
      variant: "default" as const,
      icon: AlertCircle,
      className:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
    },
  }

  const config = statusConfig[status] || statusConfig.new
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
      <Icon className="h-3 w-3" />
      {t(`status-${status}`)}
    </Badge>
  )
}

const TransactionDetails: FunctionComponent<Props> = ({ transaction }) => {
  const t = useTranslations()
  const router = useRouter()
  const locale = useLocale()

  const { created, updated, kind, value, status } = transaction.summary

  const unresolved = ["new", "retry"].includes(transaction.summary.status)

  return (
    <div>
      <h3 className="my-4 text-xl font-semibold">{t("transaction-summary")}</h3>
      <div className="flex flex-col gap-3 rounded-xl bg-flathub-white p-3 shadow-md dark:bg-flathub-arsenic">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 lg:max-w-6xl">
          <div className="grid col-span-3 md:col-span-3 grid-cols-subgrid">
            <div>{t("transaction-summary-type")}</div>
            <div className="md:col-span-2">{t(`kind-${kind}`)}</div>
          </div>
          <div className="grid col-span-3 md:col-span-3 grid-cols-subgrid">
            <div>{t("transaction-summary-status")}</div>
            <div className="md:col-span-2">
              <TransactionStatusBadge status={status} />
            </div>
          </div>
          <div className="grid col-span-3 md:col-span-3 grid-cols-subgrid">
            <div>{t("transaction-summary-created")}</div>
            <div className="md:col-span-2">
              {format(new UTCDate(created * 1000), "Pp", {
                locale: getDateFnsLocale(locale),
              })}
            </div>
          </div>
          <div className="grid col-span-3 md:col-span-3 grid-cols-subgrid">
            <div>{t("transaction-summary-updated")}</div>
            <div className="md:col-span-2">
              {format(new UTCDate(updated * 1000), "Pp", {
                locale: getDateFnsLocale(locale),
              })}
            </div>
          </div>
          <div className="grid col-span-3">
            {transaction.receipt && (
              <a
                href={transaction.receipt}
                className="no-underline hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {t("stripe-receipt")}
              </a>
            )}
            {unresolved && (
              <>
                <Alert className="flex flex-col gap-2 mt-6">
                  <AlertTitle>{t("transaction-went-wrong")}</AlertTitle>
                  <AlertDescription className="flex gap-3 justify-between">
                    <TransactionCancelButton
                      className="flex-1"
                      id={transaction.summary.id}
                      onSuccess={() => router.refresh()}
                    />
                    <Button asChild size="lg" className="flex-1">
                      <Link href={`/payment/${transaction.summary.id}`}>
                        {t("retry-checkout")}
                      </Link>
                    </Button>
                  </AlertDescription>
                </Alert>
              </>
            )}
          </div>
        </div>
        <div>
          <h3 className="pt-6 my-4 text-xl font-semibold">{t("positions")}</h3>
          <Table className="w-full lg:max-w-6xl">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">
                  {t("position-short")}
                </TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{t("recipient")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transaction.details.map((entry, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>{t(`kind-${entry.kind}`)}</TableCell>
                  <TableCell>{entry.recipient}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(entry.amount / 100, locale, entry.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>{t("total")}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(value / 100, locale)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
    </div>
  )
}

export default TransactionDetails
