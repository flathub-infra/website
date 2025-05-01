import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"
import { FunctionComponent, useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { TransactionCancelButtonPrep } from "./Checkout"

interface Props {
  onConfirm: () => void
  transactionId: string
}

const TermsAgreement: FunctionComponent<Props> = ({
  onConfirm,
  transactionId,
}) => {
  const t = useTranslations()

  const [checked, setChecked] = useState(false)

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="items-top flex space-x-3 pt-2">
        <Checkbox
          id="purcase-terms-confirm"
          checked={checked}
          onCheckedChange={(event) => {
            setChecked(Boolean(event))
          }}
        />
        <div className="grid gap-1.5 leading-none">
          <label
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            htmlFor="purcase-terms-confirm"
          >
            {t("purchase-terms-confirmation")}
          </label>
        </div>
      </div>
      <div className="flex flex-col-reverse gap-4 sm:flex-row">
        <TransactionCancelButtonPrep transactionId={transactionId} />
        <Button
          size="lg"
          className="ms-auto w-full sm:w-auto"
          disabled={!checked}
          onClick={onConfirm}
        >
          {t("continue")}
        </Button>
      </div>
    </div>
  )
}

export default TermsAgreement
