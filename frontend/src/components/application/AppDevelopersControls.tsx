import { FunctionComponent, ReactElement, useState } from "react"
import { useTranslation } from "next-i18next"
import {
  Developer,
  getDevelopers,
  inviteDeveloper,
  leaveTeam,
  removeDeveloper,
  revokeInvite,
} from "src/asyncs/directUpload"
import { Appstream } from "src/types/Appstream"
import Button from "../Button"
import InlineError from "../InlineError"
import Spinner from "../Spinner"
import ConfirmDialog from "../ConfirmDialog"
import { useUserDispatch } from "src/context/user-info"
import { useRouter } from "next/router"
import { useQuery } from "@tanstack/react-query"
import Modal from "../Modal"

interface Props {
  app: Appstream
}

const AppDevelopersControls: FunctionComponent<Props> = ({ app }) => {
  const { t } = useTranslation()
  const userDispatch = useUserDispatch()
  const router = useRouter()

  const developersQuery = useQuery({
    queryKey: ["developers", app.id],
    queryFn: () => getDevelopers(app.id),
  })

  const [inviteDialogVisible, setInviteDialogVisible] = useState(false)
  const [leaveDialogVisible, setLeaveDialogVisible] = useState(false)

  const selfIsPrimary = developersQuery.data?.developers.find((d) => d.is_self)
    ?.is_primary

  let content: ReactElement

  switch (developersQuery.status) {
    case "loading":
      content = <Spinner size="l" />
      break

    case "success":
      content = (
        <div className="space-y-6">
          <div className="space-y-3">
            {developersQuery.data.developers.map((developer) => (
              <DeveloperRow
                key={developer.id}
                developer={developer}
                app={app}
                refresh={() => developersQuery.refetch()}
                selfIsPrimary={selfIsPrimary}
                isInvite={false}
              />
            ))}
          </div>

          <div className="space-y-3">
            {developersQuery.data.invites.length > 0 && (
              <h3 className="text-xl font-bold">{t("invites")}</h3>
            )}
            {developersQuery.data.invites.map((developer) => (
              <DeveloperRow
                key={developer.id}
                developer={developer}
                app={app}
                refresh={() => developersQuery.refetch()}
                selfIsPrimary={selfIsPrimary}
                isInvite={true}
              />
            ))}
          </div>

          {selfIsPrimary && (
            <>
              <Button
                className="w-full"
                variant="primary"
                onClick={() => setInviteDialogVisible(true)}
              >
                {t("invite-developer")}
              </Button>

              <InviteDialog
                isVisible={inviteDialogVisible}
                app={app}
                refresh={() => developersQuery.refetch()}
                closeDialog={() => setInviteDialogVisible(false)}
              />
            </>
          )}

          {!selfIsPrimary && (
            <>
              <Button
                className="w-full"
                variant="destructive"
                onClick={() => setLeaveDialogVisible(true)}
              >
                {t("leave")}
              </Button>

              <ConfirmDialog
                isVisible={leaveDialogVisible}
                prompt={t("leave")}
                action={t("leave")}
                description={t("leave-confirmation", { app: app.name })}
                actionVariant="destructive"
                onConfirmed={async () => {
                  await leaveTeam(app.id, userDispatch)
                  setLeaveDialogVisible(false)
                  router.push("/my-flathub")
                }}
                onCancelled={() => setLeaveDialogVisible(false)}
              />
            </>
          )}
        </div>
      )

      break

    case "error":
      content = (
        <InlineError error={developersQuery.error as string} shown={true} />
      )
      break
  }

  return (
    <>
      <h2 className="mb-6 text-2xl font-bold">{t("developers")}</h2>
      {content}
    </>
  )
}

export default AppDevelopersControls

interface DeveloperRowProps {
  developer: Developer
  app: Appstream
  selfIsPrimary: boolean
  isInvite: boolean
  refresh: () => void
}

const DeveloperRow: FunctionComponent<DeveloperRowProps> = ({
  developer,
  app,
  selfIsPrimary,
  isInvite,
  refresh,
}) => {
  const { t } = useTranslation()

  const [dialogVisible, setDialogVisible] = useState(false)

  return (
    <>
      <div
        key={developer.id}
        className="flex items-center justify-between space-x-3"
      >
        <div>
          {developer.name}
          {developer.is_primary && (
            <span className="mx-3 text-sm text-gray-400">
              {t("primary-developer")}
            </span>
          )}
        </div>

        {selfIsPrimary && !developer.is_self && (
          <div>
            <Button
              variant="destructive"
              onClick={async () => {
                setDialogVisible(true)
              }}
            >
              {t("remove")}
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        isVisible={dialogVisible}
        prompt={t("remove-developer")}
        description={t("remove-developer-confirmation", {
          developer: developer.name,
          app: app.name,
        })}
        action={t("remove")}
        actionVariant="destructive"
        onConfirmed={async () => {
          if (isInvite) {
            await revokeInvite(app.id, developer.id)
          } else {
            await removeDeveloper(app.id, developer.id)
          }
          setDialogVisible(false)
          refresh()
        }}
        onCancelled={() => setDialogVisible(false)}
      />
    </>
  )
}

interface InviteDialogProps {
  isVisible: boolean
  app: Appstream
  refresh: () => void
  closeDialog: () => void
}

const InviteDialog: FunctionComponent<InviteDialogProps> = ({
  isVisible,
  app,
  refresh,
  closeDialog,
}) => {
  const { t } = useTranslation()

  const [inviteCode, setInviteCode] = useState("")

  const [error, setError] = useState<string | null>(null)

  const resetModal = () => {
    setInviteCode("")
    setError(null)
  }

  return (
    <Modal
      shown={isVisible}
      onClose={() => {
        closeDialog()
        resetModal()
      }}
      submitButton={{
        label: t("invite"),
        onClick: async () => {
          try {
            await inviteDeveloper(app.id, inviteCode)
          } catch (e) {
            setError(e.replaceAll("_", "-"))
            return
          }
          refresh()
          closeDialog()
          resetModal()
        },
        disabled: inviteCode.length === 0,
      }}
      cancelButton={{
        onClick: () => {
          closeDialog()
          resetModal()
        },
      }}
      title={t("invite-developer")}
      description={t("invite-developer-description", {
        developersTab: t("developers"),
      })}
    >
      <InlineError error={t(error)} shown={!!error} />
      <input
        className="w-full rounded-xl border border-flathub-sonic-silver p-3 dark:border-flathub-spanish-gray"
        value={inviteCode}
        onInput={(e) => setInviteCode((e.target as HTMLInputElement).value)}
      />
    </Modal>
  )
}
