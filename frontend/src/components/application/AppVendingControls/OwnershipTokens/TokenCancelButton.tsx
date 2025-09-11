import { useTranslations } from "next-intl"
import { FunctionComponent } from "react"
import { toast } from "sonner"
import { useMutation } from "@tanstack/react-query"
import { TokenModel } from "src/codegen/model"
import { cancelTokensVendingappAppIdTokensCancelPost } from "src/codegen"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface Props {
  token: Pick<TokenModel, "token">
  appId: string
  setState: React.Dispatch<React.SetStateAction<string>>
}

const TokenCancelButton: FunctionComponent<Props> = ({
  token,
  appId,
  setState,
}) => {
  const t = useTranslations()

  const cancelVendingTokensMutation = useMutation({
    mutationKey: ["cancel-token", appId, token.token],
    mutationFn: () => {
      return cancelTokensVendingappAppIdTokensCancelPost(appId, [token.token], {
        credentials: "include",
      })
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

  // Button is spent after successful use
  if (
    cancelVendingTokensMutation.isSuccess &&
    cancelVendingTokensMutation.data.data[0].status === "cancelled"
  ) {
    return <></>
  }

  return (
    <Button
      size="lg"
      variant="destructive"
      onClick={() => cancelVendingTokensMutation.mutate()}
      disabled={cancelVendingTokensMutation.isPending}
    >
      {cancelVendingTokensMutation.isPending && (
        <Loader2 className="animate-spin" />
      )}
      {t("cancel")}
    </Button>
  )
}

export default TokenCancelButton
