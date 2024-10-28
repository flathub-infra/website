import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import { TransactionDetailed } from "../../../types/Payment"
import { formatCurrency } from "../../../utils/localize"
import { format } from "date-fns"
import { getLocale } from "../../../localize"
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

interface Props {
  transaction: TransactionDetailed
}

const TransactionDetails: FunctionComponent<Props> = ({ transaction }) => {
  const { t, i18n } = useTranslation()

  const { created, updated, kind, value, status } = transaction.summary

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
            <div className="md:col-span-2">{t(`status-${status}`)}</div>
          </div>
          <div className="grid col-span-3 md:col-span-3 grid-cols-subgrid">
            <div>{t("transaction-summary-created")}</div>
            <div className="md:col-span-2">
              {format(new UTCDate(created * 1000), "Pp", {
                locale: getLocale(i18n.language),
              })}
            </div>
          </div>
          <div className="grid col-span-3 md:col-span-3 grid-cols-subgrid">
            <div>{t("transaction-summary-updated")}</div>
            <div className="md:col-span-2">
              {format(new UTCDate(updated * 1000), "Pp", {
                locale: getLocale(i18n.language),
              })}
            </div>
          </div>
          <div>
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
                    {formatCurrency(
                      entry.amount / 100,
                      i18n.language,
                      entry.currency,
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>{t("total")}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(value / 100, i18n.language)}
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
