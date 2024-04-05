import { useTranslation } from "next-i18next"
import { FunctionComponent, useState } from "react"
import { toast } from "react-toastify"
import { useUserDispatch } from "../../context/user-info"
import Button from "../Button"
import ConfirmDialog from "../ConfirmDialog"
import Spinner from "../Spinner"
import { useMutation } from "@tanstack/react-query"
import { AxiosError } from "axios"
import {
  doDeleteuserAuthDeleteuserPost,
  getDeleteuserAuthDeleteuserGet,
} from "src/codegen"

const DeleteButton: FunctionComponent = () => {
  const { t } = useTranslation()
  const dispatch = useUserDispatch()

  const [token, setToken] = useState<string>()
  const [text, setText] = useState("")

  const prepareDeleteUserMutation = useMutation({
    mutationKey: ["prepare-delete"],
    mutationFn: async () =>
      getDeleteuserAuthDeleteuserGet({
        withCredentials: true,
      }),
    onSuccess: (data) => {
      setToken(data.data.token)
    },
    onError: (e: AxiosError<{ detail: string }>) => {
      switch (e.response?.data?.detail) {
        case "cannot_abandon_app":
          toast.error(t("cannot-abandon-app"))
          break

        default:
          toast.error(t("network-error-try-again"))
      }
    },
  })

  const deleteUserMutation = useMutation({
    mutationKey: ["delete", token],
    mutationFn: async () =>
      doDeleteuserAuthDeleteuserPost(
        { token },
        {
          withCredentials: true,
        },
      ),
    onSuccess: () => {
      dispatch({ type: "logout" })
    },
    onError: (e: AxiosError<{ detail: string }>) => {
      if (e.response.data?.detail === "token mismatch") {
        toast.error(t("account-deletion-token-mismatch"))
      } else {
        toast.error(t("network-error-try-again"))
      }
    },
  })

  if (deleteUserMutation.isPending) {
    return <Spinner size="s" />
  }

  const entry = t("delete-account-entry")

  return (
    <>
      <Button
        onClick={() => prepareDeleteUserMutation.mutate()}
        variant="destructive"
      >
        {t("delete-account")}
      </Button>

      <ConfirmDialog
        isVisible={!!token}
        prompt={t("delete-account-prompt")}
        action={t("delete-account")}
        onConfirmed={deleteUserMutation.mutate}
        onCancelled={() => {
          setToken("")
          setText("")
        }}
        description={t("entry-confirmation-prompt", {
          text: entry,
        })}
        submitDisabled={entry && text !== entry}
      >
        <div>
          <input
            className="w-full rounded-xl border border-flathub-sonic-silver p-3 dark:border-flathub-spanish-gray"
            value={text}
            onInput={(e) => setText((e.target as HTMLInputElement).value)}
          />
        </div>
      </ConfirmDialog>
    </>
  )
}

export default DeleteButton
