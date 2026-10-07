import { ReactElement, useState } from "react"
import { useTranslations } from "next-intl"
import Spinner from "src/components/Spinner"
import ConfirmDialog from "src/components/ConfirmDialog"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { AxiosError } from "axios"
import Modal from "../Modal"
import {
  archiveVerificationAppIdArchivePost,
  GetAppstreamAppstreamAppIdGet200,
  switchToDirectUploadVerificationAppIdSwitchToDirectUploadPost,
  useGetUploadTokensUploadTokensAppIdGet,
} from "src/codegen"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline"

function DangerAcknowledgement({
  id,
  checked,
  onCheckedChange,
  title,
  consequences,
  label,
}: {
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  title: string
  consequences: string[]
  label: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-4 dark:bg-destructive/10">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon
            aria-hidden="true"
            className="mt-0.5 size-6 shrink-0 text-destructive"
          />
          <div className="space-y-2">
            <h4 className="font-semibold text-destructive">{title}</h4>
            <ul className="list-disc space-y-1 ps-5 text-sm text-foreground">
              {consequences.map((consequence) => (
                <li key={consequence}>{consequence}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-lg border p-3">
        <Checkbox
          id={id}
          className="mt-1"
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(Boolean(value))}
        />
        <label
          htmlFor={id}
          className="cursor-pointer text-sm font-medium leading-relaxed"
        >
          {label}
        </label>
      </div>
    </div>
  )
}

const SwitchToDirectUpload = ({
  app,
}: {
  app: Pick<GetAppstreamAppstreamAppIdGet200, "id">
}) => {
  const t = useTranslations()
  const [modalVisible, setModalVisible] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

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
      <Button
        onClick={() => {
          setAcknowledged(false)
          setModalVisible(true)
        }}
        variant="secondary"
      >
        {t("switch-to-direct-upload")}
      </Button>
      <ConfirmDialog
        isVisible={modalVisible}
        action={t("confirm")}
        prompt={t("switch-to-direct-upload")}
        actionVariant="destructive"
        submitDisabled={!acknowledged || switchToDirectUploadMutation.isPending}
        onConfirmed={() => switchToDirectUploadMutation.mutate()}
        onCancelled={() => setModalVisible(false)}
      >
        <DangerAcknowledgement
          id="direct-upload-confirmation"
          checked={acknowledged}
          onCheckedChange={setAcknowledged}
          title={t("danger-zone-confirmation.switch.warning-title")}
          consequences={[
            t("danger-zone-confirmation.switch.warning-consequence"),
          ]}
          label={t.rich("danger-zone-confirmation.switch.acknowledgment", {
            app_id: app.id,
            app: (chunks) => <strong>{chunks}</strong>,
          })}
        />
      </ConfirmDialog>
    </>
  )
}

const ArchiveApp = ({ app }: { app: { id: string } }) => {
  const t = useTranslations()
  const [modalVisible, setModalVisible] = useState(false)
  const [endoflife, setEndoflife] = useState("")
  const [endoflifeRebase, setEndoflifeRebase] = useState("")
  const [acknowledged, setAcknowledged] = useState(false)

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
      <Button
        onClick={() => {
          setAcknowledged(false)
          setModalVisible(true)
        }}
        variant="secondary"
      >
        {t("archive-app")}
      </Button>
      <Modal
        shown={modalVisible}
        title={t("archive-app")}
        onClose={() => setModalVisible(false)}
        description={t("do-you-really-want-to-archive-app")}
        size="lg"
        cancelButton={{
          onClick: () => setModalVisible(false),
          disabled: archiveAppMutation.isPending,
        }}
        submitButton={{
          onClick: () => archiveAppMutation.mutate(),
          label: t("archive"),
          disabled: !acknowledged || archiveAppMutation.isPending,
          variant: "destructive",
        }}
      >
        <div className="space-y-3">
          <DangerAcknowledgement
            id="archive-app-confirmation"
            checked={acknowledged}
            onCheckedChange={setAcknowledged}
            title={t("danger-zone-confirmation.archive.warning-title")}
            consequences={[
              t("danger-zone-confirmation.archive.warning-tokens"),
              t("danger-zone-confirmation.archive.warning-eol"),
            ]}
            label={t.rich("danger-zone-confirmation.archive.acknowledgment", {
              app_id: app.id,
              app: (chunks) => <strong>{chunks}</strong>,
            })}
          />
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

export default function DangerZoneControls({
  app,
}: {
  app: Pick<GetAppstreamAppstreamAppIdGet200, "id">
}) {
  const t = useTranslations()

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
