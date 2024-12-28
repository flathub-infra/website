import { FunctionComponent, ReactElement, useState } from "react"
import { useTranslation } from "next-i18next"
import { Appstream } from "src/types/Appstream"
import InlineError from "../InlineError"
import Spinner from "../Spinner"
import ConfirmDialog from "../ConfirmDialog"
import { useUserDispatch } from "src/context/user-info"
import { useRouter } from "next/router"
import { useMutation, useQuery } from "@tanstack/react-query"
import Modal from "../Modal"
import { getUserData } from "src/asyncs/login"
import { AxiosError } from "axios"
import {
  getAppDevelopersInvitesAppIdDevelopersGet,
  inviteDeveloperInvitesAppIdInvitePost,
  leaveTeamInvitesAppIdLeavePost,
  removeDeveloperInvitesAppIdRemoveDeveloperPost,
  revokeInviteInvitesAppIdRevokePost,
} from "src/codegen"
import { Developer } from "src/codegen/model"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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
      getAppDevelopersInvitesAppIdDevelopersGet(app.id, {
        withCredentials: true,
      }),
  })

  const leaveTeamInviteMutation = useMutation({
    mutationKey: ["leave-team-invite-app", app.id],
    mutationFn: () =>
      leaveTeamInvitesAppIdLeavePost(app.id, {
        withCredentials: true,
      }),
    onSuccess: async () => {
      await getUserData(userDispatch)
      setLeaveDialogVisible(false)
      router.push("/developer-portal")
    },
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
            {developersQuery.data.data.developers
              .sort((a, b) => {
                const sortByPrimary =
                  Number(b.is_primary) - Number(a.is_primary)

                if (sortByPrimary !== 0) {
                  return sortByPrimary
                }
                return a.name.localeCompare(b.name)
              })
              .map((developer) => (
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
            {developersQuery.data.data.invites
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((developer) => (
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
                size="lg"
                className="w-full"
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
                size="lg"
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
                onConfirmed={leaveTeamInviteMutation.mutate}
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

  const revokeInviteMutation = useMutation({
    mutationKey: ["revoke-invite-app", app.id, developer.id],
    mutationFn: () =>
      revokeInviteInvitesAppIdRevokePost(
        app.id,
        { invite_id: developer.id },
        {
          withCredentials: true,
        },
      ),
    onSuccess: async () => {
      setDialogVisible(false)
      refresh()
    },
  })

  const removeDeveloperInviteMutation = useMutation({
    mutationKey: ["remove-developer-invite-app", app.id, developer.id],
    mutationFn: () =>
      removeDeveloperInvitesAppIdRemoveDeveloperPost(
        app.id,
        { developer_id: developer.id },
        {
          withCredentials: true,
        },
      ),
    onSuccess: async () => {
      setDialogVisible(false)
      refresh()
    },
  })

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
              size="lg"
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
        onConfirmed={() => {
          if (isInvite) {
            revokeInviteMutation.mutate()
          } else {
            removeDeveloperInviteMutation.mutate()
          }
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

  const inviteDeveloperMutation = useMutation({
    mutationKey: ["invite-developer-app", app.id, inviteCode],
    mutationFn: () =>
      inviteDeveloperInvitesAppIdInvitePost(
        app.id,
        { invite_code: inviteCode },
        {
          withCredentials: true,
        },
      ),
    onSuccess: async () => {
      refresh()
      closeDialog()
      resetModal()
    },
    onError: (e: AxiosError<{ detail: string }>) => {
      setError(e.response.data.detail.replaceAll("_", "-"))
    },
  })

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
        onClick: () => inviteDeveloperMutation.mutate(),
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
      <Input
        value={inviteCode}
        onInput={(e) => setInviteCode((e.target as HTMLInputElement).value)}
      />
    </Modal>
  )
}
