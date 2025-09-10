import { FunctionComponent, ReactElement, useState } from "react"
import { useTranslations } from "next-intl"
import Spinner from "src/components/Spinner"
import CodeCopy from "../CodeCopy"
import Modal from "src/components/Modal"
import { Repo } from "src/types/UploadTokens"
import { useMutation } from "@tanstack/react-query"
import { createUploadTokenUploadTokensAppIdPost } from "src/codegen"
import { NewTokenResponse } from "src/codegen/model"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"

interface Props {
  app_id: string
  repo: Repo
  visible: boolean
  cancel: () => void
  created?: (response: NewTokenResponse) => void
}

const NewTokenDialog: FunctionComponent<Props> = ({
  app_id,
  repo,
  visible,
  cancel,
  created,
}) => {
  const t = useTranslations()

  const [state, setState] = useState<"new" | "pending" | "copy-token">("new")

  const title = repo === "beta" ? t("new-beta-token") : t("new-stable-token")

  const [comment, setComment] = useState("")
  const [scopes, setScopes] = useState(["build", "upload", "publish", "jobs"])
  const [token, setToken] = useState("")

  const createUploadTokenMutation = useMutation({
    mutationKey: ["create-upload-token", app_id, scopes, repo, comment],
    mutationFn: () =>
      createUploadTokenUploadTokensAppIdPost(
        app_id,
        {
          comment,
          scopes,
          repos: [repo],
        },
        {
          credentials: "include",
        },
      ),
    onSuccess: (response) => {
      if (response.data && typeof response.data === 'object' && 'token' in response.data) {
        setToken(response.data.token)
        setState("copy-token")
        created?.(response.data)
      }
    },
  })

  const setScope = (scope: string, checked: boolean) => {
    if (checked) {
      if (!scopes.includes(scope)) {
        setScopes([...scopes, scope])
      }
    } else {
      setScopes(scopes.filter((s) => s !== scope))
    }
  }

  const hideDialog = () => {
    setState("new")
    setComment("")
    cancel()
  }

  let content: ReactElement
  let cancelButton
  let submitButton

  switch (state) {
    case "new":
      content = (
        <>
          <Input
            placeholder={t("token-name")}
            value={comment}
            onInput={(e) => setComment((e.target as HTMLInputElement).value)}
          />

          <div>
            <h4 className="mt-3 mb-1 font-bold">{t("scopes")}</h4>
            {["build", "upload", "publish", "jobs"].map((scope) => (
              <div key={scope} className="items-top flex space-x-2 pt-2">
                <Checkbox
                  id={`scope-${scope}`}
                  checked={scopes.includes(scope)}
                  onCheckedChange={(event) => setScope(scope, Boolean(event))}
                  disabled={scope === "build"}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    htmlFor={`scope-${scope}`}
                  >
                    {t(`scope-${scope}`)}
                  </label>
                </div>
              </div>
            ))}
          </div>
        </>
      )
      cancelButton = {
        label: t("cancel"),
        onClick: hideDialog,
      }
      submitButton = {
        label: t("create-token"),
        onClick: () => {
          setState("pending")
          createUploadTokenMutation.mutate()
        },
        disabled: !comment,
      }
      break
    case "pending":
      content = <Spinner size="m" />
      break
    case "copy-token":
      content = (
        <>
          <p>{t("token-created")}</p>
          <CodeCopy text={token} />
        </>
      )
      break
  }

  return (
    <Modal
      shown={visible}
      onClose={hideDialog}
      title={title}
      cancelButton={cancelButton}
      submitButton={submitButton}
    >
      {content}
    </Modal>
  )
}

export default NewTokenDialog
