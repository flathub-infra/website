import { FunctionComponent, ReactElement, useState } from "react"
import { useTranslation } from "next-i18next"
import Spinner from "src/components/Spinner"
import CodeCopy from "../CodeCopy"
import Modal from "src/components/Modal"
import { Repo } from "src/types/UploadTokens"
import { useMutation } from "@tanstack/react-query"
import { createUploadTokenUploadTokensAppIdPost } from "src/codegen"
import { NewTokenResponse } from "src/codegen/model"

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
  const { t } = useTranslation()

  const [state, setState] = useState<"new" | "pending" | "copy-token">("new")

  const title = repo === "beta" ? t("new-beta-token") : t("new-stable-token")

  const [comment, setComment] = useState("")
  const [scopes, setScopes] = useState(["build", "upload", "publish"])
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
          withCredentials: true,
        },
      ),
    onSuccess: (response) => {
      setToken(response.data.token)
      setState("copy-token")
      created?.(response.data)
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
          <input
            className="w-full rounded-xl border border-flathub-sonic-silver p-3 dark:border-flathub-spanish-gray"
            placeholder={t("token-name")}
            value={comment}
            onInput={(e) => setComment((e.target as HTMLInputElement).value)}
          />

          <div>
            <h4 className="mt-3 mb-1 font-bold">{t("scopes")}</h4>
            {["build", "upload", "publish"].map((scope) => (
              <div key={scope} className="ms-1">
                <input
                  id={`scope-${scope}`}
                  type="checkbox"
                  className="me-2"
                  checked={scopes.includes(scope)}
                  onChange={(event) => setScope(scope, event.target.checked)}
                  disabled={scope === "build"}
                />
                <label htmlFor={`scope-${scope}`}>{t(`scope-${scope}`)}</label>
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
