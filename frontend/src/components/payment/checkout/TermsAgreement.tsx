import { useTranslation } from "next-i18next"
import { FunctionComponent, ReactElement, useCallback, useState } from "react"
import Button from "../../Button"

interface Props {
  onConfirm: () => void
  transactionCancelButton: ReactElement
}

const TermsAgreement: FunctionComponent<Props> = ({
  onConfirm,
  transactionCancelButton,
}) => {
  const { t } = useTranslation()

  const [checked, setChecked] = useState(false)

  const invertCheck = useCallback(() => setChecked(!checked), [checked])

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="relative flex items-start">
        <div className="flex h-5 items-center">
          <input
            id="save-card"
            type="checkbox"
            checked={checked}
            onChange={invertCheck}
            aria-describedby="card-description"
            className="size-4"
          />
        </div>
        <div className="ms-3 text-sm">
          <label htmlFor="save-card" className="font-medium">
            {t("purchase-terms-confirmation")}
          </label>
        </div>
      </div>
      <div className="flex flex-col-reverse gap-4 sm:flex-row">
        {transactionCancelButton}
        <Button
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
