import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import { toast } from "react-toastify"
import Button from "../../../Button"
import Spinner from "../../../Spinner"
import { useMutation } from "@tanstack/react-query"
import { vendingApi } from "src/api"
import { TokenModel } from "src/codegen"

interface Props {
  token: TokenModel
  appId: string
  setState: React.Dispatch<React.SetStateAction<string>>
}

const TokenCancelButton: FunctionComponent<Props> = ({
  token,
  appId,
  setState,
}) => {
  const { t } = useTranslation()

  const cancelVendingTokensMutation = useMutation({
    mutationKey: ["cancel-token", appId, token.id],
    mutationFn: () => {
      return vendingApi.cancelTokensVendingappAppIdTokensCancelPost(
        appId,
        [token.id],
        {
          withCredentials: true,
        },
      )
    },
    onSuccess: (data) => {
      if (data.data[0].status === "cancelled") {
        setState("cancelled")
        toast.success(t("token-cancelled"))
      }
    },
    onError: (error) => {
      toast.error(t(error.message))
    },
  })

  if (cancelVendingTokensMutation.isPending) {
    return <Spinner size="s" />
  }

  // Button is spent after successful use
  if (
    cancelVendingTokensMutation.isSuccess &&
    cancelVendingTokensMutation.data.data[0].status === "cancelled"
  ) {
    return <></>
  }

  return (
    <Button
      variant="destructive"
      onClick={() => cancelVendingTokensMutation.mutate()}
    >
      {t("cancel")}
    </Button>
  )
}

export default TokenCancelButton
