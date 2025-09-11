import { useTranslations } from "next-intl"
import { FunctionComponent, useCallback, useState } from "react"
import { Appstream } from "../../../../types/Appstream"
import Modal from "src/components/Modal"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { createTokensVendingappAppIdTokensPost } from "src/codegen"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface Props {
  app: Pick<Appstream, "id">
  updateCallback: CallableFunction
}

/**
 * The button to open a model dialog where application ownership tokens can be generated.
 */
const TokenCreateDialog: FunctionComponent<Props> = ({
  app,
  updateCallback,
}) => {
  const t = useTranslations()

  const [shown, setShown] = useState(false)
  const [text, setText] = useState("")

  const names = text.split(/\s*\n\s*/).filter((name) => name !== "")

  const createVendingTokensMutation = useMutation({
    mutationKey: ["create-token", app.id, names],
    mutationFn: () => {
      return createTokensVendingappAppIdTokensPost(app.id, names, {
        credentials: "include",
      })
    },
    onSuccess: () => {
      updateCallback()
      setText("")
      setShown(false)
    },
    onError: (err: Error) => {
      toast.error(t(err.response.data.error))
    },
  })

  const textUpdate = useCallback((event) => setText(event.target.value), [])

  return (
    <>
      <Button size="lg" onClick={() => setShown(true)}>
        {t("create-tokens")}
      </Button>
      <Modal
        shown={shown}
        title={t("create-tokens")}
        onClose={() => {
          setShown(false)
          setText("")
        }}
        submitButton={{
          onClick: () => {
            createVendingTokensMutation.mutate()
          },
          disabled: names.length === 0,
        }}
      >
        <div className="space-y-3">
          <div>{t("token-creation-placeholder")}</div>
          <Textarea value={text} onChange={textUpdate} className="h-40" />
        </div>
      </Modal>
    </>
  )
}

export default TokenCreateDialog
