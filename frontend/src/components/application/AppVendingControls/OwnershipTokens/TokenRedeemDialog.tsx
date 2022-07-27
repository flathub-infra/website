import { useTranslation } from "next-i18next"
import { FunctionComponent, useCallback, useEffect, useState } from "react"
import { toast } from "react-toastify"
import { redeemVendingToken } from "../../../../asyncs/vending"
import { useAsync } from "../../../../hooks/useAsync"
import { Appstream } from "../../../../types/Appstream"
import Button from "../../../Button"

interface Props {
  app: Appstream
}

/**
 * A set of controls for redemption of application ownership tokens.
 */
const TokenRedeemDialog: FunctionComponent<Props> = ({ app }) => {
  const { t } = useTranslation()

  const [text, setText] = useState("")

  const textUpdate = useCallback((event) => setText(event.target.value), [])
  const {
    execute: onSubmit,
    value,
    status,
    error,
  } = useAsync(
    useCallback(() => {
      // Strip leading and trailing whitespace characters
      const token = text.trim()

      setText("")

      if (token.length > 0) {
        return redeemVendingToken(app.id, token)
      }
    }, [app.id, text]),
    false,
  )

  useEffect(() => {
    if (value?.status === "failure") {
      toast.error("Failed to redeem token")
    }
    if (value?.status === "success") {
      toast.success("Ownership token redeemed")
    }
  }, [value])

  return (
    <div className="inline-flex gap-2 rounded-xl bg-bgColorSecondary p-4">
      <input
        type="text"
        placeholder="Enter an ownership token"
        value={text}
        onChange={textUpdate}
        className="w-80 rounded-xl bg-bgColorPrimary p-2"
      />
      <Button onClick={onSubmit}>{t("redeem-token")}</Button>
    </div>
  )
}

export default TokenRedeemDialog
