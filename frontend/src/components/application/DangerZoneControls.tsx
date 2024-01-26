import { ReactElement, useState } from "react"
import { useTranslation } from "next-i18next"
import Button from "src/components/Button"
import Spinner from "src/components/Spinner"
import ConfirmDialog from "src/components/ConfirmDialog"
import { useMutation, useQuery } from "@tanstack/react-query"
import { uploadTokensApi, verificationApi } from "src/api"
import { toast } from "react-toastify"
import { AxiosError } from "axios"
import Modal from "../Modal"
import { Notice } from "../Notice"

const SwitchToDirectUpload = ({ app }: { app: { id: string } }) => {
  const { t } = useTranslation()
  const [modalVisible, setModalVisible] = useState(false)

  const switchToDirectUploadMutation = useMutation({
    mutationFn: () =>
      verificationApi.switchToDirectUploadVerificationAppIdSwitchToDirectUploadPost(
        app.id,
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
      verificationApi.archiveVerificationAppIdArchivePost(
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
            <textarea
              value={endoflife}
              onChange={(e) => setEndoflife(e.target.value)}
              className="h-20 rounded-xl p-3 w-full"
            />
          </div>
          <div>
            {t("rebase-onto-other-app")}
            <input
              type="text"
              placeholder={t("app-id")}
              value={endoflifeRebase}
              onChange={(e) => setEndoflifeRebase(e.target.value)}
              className="rounded-xl p-3 w-full"
            />
          </div>
        </div>
      </Modal>
    </>
  )
}

export default function DangerZoneControls({ app }: { app: { id: string } }) {
  const { t } = useTranslation()

  const query = useQuery({
    queryKey: ["upload-tokens", app.id, false],
    queryFn: () =>
      uploadTokensApi.getUploadTokensUploadTokensAppIdGet(app.id, false, {
        withCredentials: true,
      }),
    enabled: !!app.id,
  })

  let content: ReactElement
  if (query.isPending) {
    content = <Spinner size="m" />
  } else if (query.status === "error") {
    content = <p>{t("error-occurred")}</p>
  } else {
    content = (
      <Notice variant="danger">
        <div className="flex flex-col gap-3">
          {!query.data.data.is_direct_upload_app && (
            <SwitchToDirectUpload app={app} />
          )}
          <ArchiveApp app={app} />
        </div>
      </Notice>
    )
  }

  return <>{content}</>
}
