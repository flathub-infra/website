import { useTranslation } from "next-i18next"
import { useCallback, useState } from "react"
import { toast } from "react-toastify"
import { Appstream } from "../../../../types/Appstream"
import Spinner from "../../../Spinner"
import { useMutation } from "@tanstack/react-query"
import { redeemTokenVendingappAppIdTokensRedeemTokenPost } from "src/codegen"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/**
 * A set of controls for redemption of application ownership tokens.
 */
const TokenRedeemDialog = ({ app }: { app: Pick<Appstream, "id"> }) => {
  const { t } = useTranslation()

  const [text, setText] = useState("")

  const textUpdate = useCallback((event) => setText(event.target.value), [])

  const redeemVendingToken = useMutation({
    mutationFn: () => {
      // Strip leading and trailing whitespace characters
      const token = text.trim()

      setText("")

      return redeemTokenVendingappAppIdTokensRedeemTokenPost(app.id, token, {
        withCredentials: true,
      })
    },
    onSuccess: (data) => {
      if (data.data?.status === "failure") {
        toast.error(t("token-failed"))
      }
      if (data.data?.status === "success") {
        toast.success(t("token-redeemed"))
      }
    },
    onError: (error) => {
      toast.error(t(error.message))
    },
  })

  if (redeemVendingToken.isPending) {
    return <Spinner size={"s"} />
  }

  return (
    <div className="inline-flex gap-2 rounded-xl bg-flathub-white p-4 dark:bg-flathub-arsenic">
      <Input
        type="text"
        placeholder={t("token-redeem-placeholder")}
        value={text}
        onChange={textUpdate}
        className="w-80"
      />
      <Button
        size="xl"
        disabled={text.trim().length === 0}
        onClick={() => redeemVendingToken.mutate()}
      >
        {t("redeem-token")}
      </Button>
    </div>
  )
}

export default TokenRedeemDialog
