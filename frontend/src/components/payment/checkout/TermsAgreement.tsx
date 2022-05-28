import { useTranslation } from "next-i18next"
import { FunctionComponent, useCallback, useState } from "react"
import Button from "../../Button"

interface Props {
  onConfirm: () => void
}

const TermsAgreement: FunctionComponent<Props> = ({ onConfirm }) => {
  const { t } = useTranslation()

  const [checked, setChecked] = useState(false)

  const invertCheck = useCallback(() => setChecked(!checked), [checked])

  return (
    <div className="flex flex-col gap-5 p-5">
      <div>
        <input
          id="save-card"
          type="checkbox"
          checked={checked}
          onChange={invertCheck}
        />
        <label>{t("purchase-terms-confirmation")}</label>
      </div>
      <div>
        <Button disabled={!checked} onClick={onConfirm}>
          {t("continue")}
        </Button>
      </div>
    </div>
  )
}

export default TermsAgreement
