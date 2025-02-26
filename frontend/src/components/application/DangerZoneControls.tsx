import { ReactElement, useState } from "react"
import { useTranslation } from "next-i18next"
import Spinner from "src/components/Spinner"
import ConfirmDialog from "src/components/ConfirmDialog"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { AxiosError } from "axios"
import Modal from "../Modal"
import {
  archiveVerificationAppIdArchivePost,
  switchToDirectUploadVerificationAppIdSwitchToDirectUploadPost,
  useGetUploadTokensUploadTokensAppIdGet,
} from "src/codegen"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Appstream } from "src/types/Appstream"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"

const SwitchToDirectUpload = ({ app }: { app: Pick<Appstream, "id"> }) => {
  const { t } = useTranslation()
  const [modalVisible, setModalVisible] = useState(false)

  const switchToDirectUploadMutation = useMutation({
    mutationFn: () =>
      switchToDirectUploadVerificationAppIdSwitchToDirectUploadPost(app.id, {
        withCredentials: true,
      }),
    onSuccess: () => {
      setModalVisible(false)
    },
    onError: (err: AxiosError<{ detail: string }>) => {
      toast.error(t(err.response.data.detail))
    },
  })

  return (
    <>
      <Button onClick={() => setModalVisible(true)} variant="secondary">
        {t("switch-to-direct-upload")}
      </Button>
      <ConfirmDialog
        isVisible={modalVisible}
        action={t("confirm")}
        prompt={t("switch-to-direct-upload")}
        actionVariant="destructive"
        onConfirmed={() => switchToDirectUploadMutation.mutate()}
        onCancelled={() => setModalVisible(false)}
      >
        {t("do-you-really-want-to-switch-to-direct-upload")}
      </ConfirmDialog>
    </>
  )
}

const ArchiveApp = ({ app }: { app: { id: string } }) => {
  const { t } = useTranslation()
  const [modalVisible, setModalVisible] = useState(false)
  const [endoflife, setEndoflife] = useState("")
  const [endoflifeRebase, setEndoflifeRebase] = useState("")

  const archiveAppMutation = useMutation({
    mutationFn: () =>
      archiveVerificationAppIdArchivePost(
        app.id,
        {
          endoflife: endoflife,
          endoflife_rebase: endoflifeRebase,
        },
        {
          withCredentials: true,
        },
      ),
    onSuccess: () => {
      setModalVisible(false)
    },
    onError: (err: AxiosError<{ detail: string }>) => {
      toast.error(t(err.response.data.detail))
    },
  })

  return (
    <>
      <Button onClick={() => setModalVisible(true)} variant="secondary">
        {t("archive-app")}
      </Button>
      <Modal
        shown={modalVisible}
        title={t("archive-app")}
        onClose={() => setModalVisible(false)}
        description={t("do-you-really-want-to-archive-app")}
        cancelButton={{ onClick: () => setModalVisible(false) }}
        submitButton={{
          onClick: () => archiveAppMutation.mutate(),
          label: t("archive"),
        }}
      >
        <div className="space-y-3">
          <div>
            {t("enter-end-of-life-message")}
            <Textarea
              value={endoflife}
              onChange={(e) => setEndoflife(e.target.value)}
              className="h-20"
            />
          </div>
          <div>
            {t("rebase-onto-other-app")}
            <Input
              type="text"
              placeholder={t("app-id")}
              value={endoflifeRebase}
              onChange={(e) => setEndoflifeRebase(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </>
  )
}

export default function DangerZoneControls({ app }: { app: { id: string } }) {
  const { t } = useTranslation()

  const query = useGetUploadTokensUploadTokensAppIdGet(
    app.id,
    {
      include_expired: false,
    },
    {
      axios: { withCredentials: true },
      query: {
        enabled: !!app.id,
      },
    },
  )

  let content: ReactElement
  if (query.isPending) {
    content = <Spinner size="m" />
  } else if (query.status === "error") {
    content = <p>{t("error-occurred")}</p>
  } else {
    content = (
      <>
        <Alert variant="destructive">
          <AlertDescription className="flex flex-col gap-3">
            {!query.data.data.is_direct_upload_app && (
              <SwitchToDirectUpload app={app} />
            )}
            <ArchiveApp app={app} />
          </AlertDescription>
        </Alert>
      </>
    )
  }

  return <>{content}</>
}
