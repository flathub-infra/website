import { FunctionComponent, ReactElement, useState } from "react"
import { useTranslation } from "next-i18next"
import { Appstream } from "src/types/Appstream"
import Button from "../Button"
import InlineError from "../InlineError"
import Spinner from "../Spinner"
import ConfirmDialog from "../ConfirmDialog"
import { useUserDispatch } from "src/context/user-info"
import { useRouter } from "next/router"
import { useQuery } from "@tanstack/react-query"
import Modal from "../Modal"
import { inviteApi } from "src/api"
import { getUserData } from "src/asyncs/login"
import { Developer } from "src/codegen"

interface Props {
  app: Appstream
}

const AppDevelopersControls: FunctionComponent<Props> = ({ app }) => {
  const { t } = useTranslation()
  const userDispatch = useUserDispatch()
  const router = useRouter()

  const developersQuery = useQuery({
    queryKey: ["developers", app.id],
    queryFn: () =>
      inviteApi.getDevelopersInvitesAppIdDevelopersGet(app.id, {
        withCredentials: true,
      }),
  })

  const [inviteDialogVisible, setInviteDialogVisible] = useState(false)
  const [leaveDialogVisible, setLeaveDialogVisible] = useState(false)

  const selfIsPrimary = developersQuery.data?.data.developers.find(
    (d) => d.is_self,
  )?.is_primary

  let content: ReactElement

  switch (developersQuery.status) {
    case "pending":
      content = <Spinner size="l" />
      break

    case "success":
      content = (
        <div className="space-y-6">
          <div className="space-y-3">
            {developersQuery.data.data.developers.map((developer) => (
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
            {developersQuery.data.data.invites.length > 0 && (
              <h3 className="text-xl font-bold">{t("invites")}</h3>
            )}
            {developersQuery.data.data.invites.map((developer) => (
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
                  await inviteApi.leaveTeamInvitesAppIdLeavePost(app.id, {
                    withCredentials: true,
                  })
                  await getUserData(userDispatch)
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
        <InlineError error={t(developersQuery.error.message)} shown={true} />
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
            await inviteApi.revokeInviteInvitesAppIdRevokePost(
              app.id,
              developer.id,
              {
                withCredentials: true,
              },
            )
          } else {
            await inviteApi.removeDeveloperInvitesAppIdRemoveDeveloperPost(
              app.id,
              developer.id,
              {
                withCredentials: true,
              },
            )
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
            await inviteApi.inviteDeveloperInvitesAppIdInvitePost(
              app.id,
              inviteCode,
              {
                withCredentials: true,
              },
            )
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
