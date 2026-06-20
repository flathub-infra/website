"use client"

import { useState } from "react"
import ConfirmDialog from "src/components/ConfirmDialog"
import {
  Permission,
  GetUserinfoAuthUserinfoGet200,
  ManagedAppResponse,
  useListDirectUploadAppsDirectUploadAppsGet,
  useSwitchToDirectUploadDirectUploadAppsPost,
  useSwitchOffDirectUploadDirectUploadAppsAppIdDelete,
  useRevokeTokensDirectUploadAppsAppIdRevokeTokensPost,
  useUpdateRuntimeScopeDirectUploadAppsAppIdScopePatch,
  useAddMaintainerDirectUploadAppsAppIdMaintainersPost,
  useRemoveMaintainerDirectUploadAppsAppIdMaintainersUserIdDelete,
  useSetPrimaryMaintainerDirectUploadAppsAppIdMaintainersUserIdSetPrimaryPost,
} from "src/codegen"
import AdminLayoutClient from "src/components/AdminLayoutClient"
import Spinner from "src/components/Spinner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const ALL_REPOS = ["stable", "beta"]

const splitList = (value: string): string[] =>
  value
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)

function Field({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  )
}

function RepoCheckboxes({
  repos,
  onChange,
  idPrefix,
}: {
  repos: string[]
  onChange: (repos: string[]) => void
  idPrefix: string
}) {
  const toggle = (repo: string, checked: boolean) => {
    if (checked) {
      if (!repos.includes(repo)) onChange([...repos, repo])
    } else {
      onChange(repos.filter((r) => r !== repo))
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">Repos</span>
      <div className="flex gap-4">
        {ALL_REPOS.map((repo) => (
          <div key={repo} className="flex items-center gap-2">
            <Checkbox
              id={`${idPrefix}-repo-${repo}`}
              checked={repos.includes(repo)}
              onCheckedChange={(checked) => toggle(repo, Boolean(checked))}
            />
            <label htmlFor={`${idPrefix}-repo-${repo}`} className="text-sm">
              {repo}
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}

function SwitchToDirectUploadForm({ onCreated }: { onCreated: () => void }) {
  const [appId, setAppId] = useState("")
  const [maintainerId, setMaintainerId] = useState("")
  const [isRuntime, setIsRuntime] = useState(false)
  const [prefixes, setPrefixes] = useState("")
  const [extraIds, setExtraIds] = useState("")
  const [repos, setRepos] = useState<string[]>(["stable", "beta"])

  const mutation = useSwitchToDirectUploadDirectUploadAppsPost({
    axios: { withCredentials: true },
  })

  const submit = () => {
    mutation.mutate(
      {
        data: {
          app_id: appId.trim(),
          primary_maintainer_user_id: Number(maintainerId),
          scope: isRuntime
            ? {
                prefixes: splitList(prefixes),
                extra_ids: splitList(extraIds),
                repos,
              }
            : undefined,
        },
      },
      {
        onSuccess: () => {
          setAppId("")
          setMaintainerId("")
          setIsRuntime(false)
          setPrefixes("")
          setExtraIds("")
          setRepos(["stable", "beta"])
          onCreated()
        },
      },
    )
  }

  const disabled =
    !appId.trim() ||
    !maintainerId.trim() ||
    Number.isNaN(Number(maintainerId)) ||
    (isRuntime && splitList(prefixes).length === 0) ||
    mutation.isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle>Switch app to direct upload</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Field id="new-app-id" label="App ID">
          <Input
            id="new-app-id"
            placeholder="org.example.App"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
          />
        </Field>
        <Field id="new-maintainer" label="Primary maintainer user ID">
          <Input
            id="new-maintainer"
            type="number"
            placeholder="123"
            value={maintainerId}
            onChange={(e) => setMaintainerId(e.target.value)}
          />
        </Field>
        <div className="flex items-center gap-2">
          <Checkbox
            id="new-is-runtime"
            checked={isRuntime}
            onCheckedChange={(checked) => setIsRuntime(Boolean(checked))}
          />
          <label htmlFor="new-is-runtime" className="text-sm font-medium">
            This is a runtime (add runtime scope)
          </label>
        </div>
        {isRuntime && (
          <>
            <Field
              id="new-prefixes"
              label="Prefixes (space or comma separated)"
            >
              <Input
                id="new-prefixes"
                placeholder="org.gnome.Platform org.gnome.Sdk"
                value={prefixes}
                onChange={(e) => setPrefixes(e.target.value)}
              />
            </Field>
            <Field
              id="new-extra-ids"
              label="Extra IDs (optional, space or comma separated)"
            >
              <Input
                id="new-extra-ids"
                placeholder="org.gnome.Sdk.Docs"
                value={extraIds}
                onChange={(e) => setExtraIds(e.target.value)}
              />
            </Field>
            <RepoCheckboxes repos={repos} onChange={setRepos} idPrefix="new" />
          </>
        )}
        {mutation.isError && (
          <p className="text-flathub-electric-red text-sm">
            Failed to switch app to direct upload.
          </p>
        )}
        <div>
          <Button size="lg" onClick={submit} disabled={disabled}>
            Switch to direct upload
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function RuntimeScopeSection({
  app,
  onChanged,
}: {
  app: ManagedAppResponse
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [prefixes, setPrefixes] = useState("")
  const [extraIds, setExtraIds] = useState("")

  const mutation = useUpdateRuntimeScopeDirectUploadAppsAppIdScopePatch({
    axios: { withCredentials: true },
  })

  if (!app.scope) return null
  const {
    prefixes: currentPrefixes,
    extra_ids: currentExtraIds,
    repos,
  } = app.scope

  const startEdit = () => {
    setPrefixes(currentPrefixes.join(" "))
    setExtraIds(currentExtraIds.join(" "))
    setEditing(true)
  }

  const save = () => {
    mutation.mutate(
      {
        appId: app.app_id,
        data: {
          prefixes: splitList(prefixes),
          extra_ids: splitList(extraIds),
        },
      },
      {
        onSuccess: () => {
          setEditing(false)
          onChanged()
        },
      },
    )
  }

  return (
    <div className="border-t pt-3 flex flex-col gap-2">
      <span className="text-sm font-semibold">Runtime scope</span>
      {editing ? (
        <>
          <Field
            id={`${app.app_id}-edit-prefixes`}
            label="Prefixes (space or comma separated)"
          >
            <Input
              id={`${app.app_id}-edit-prefixes`}
              value={prefixes}
              onChange={(e) => setPrefixes(e.target.value)}
            />
          </Field>
          <Field
            id={`${app.app_id}-edit-extra-ids`}
            label="Extra IDs (space or comma separated)"
          >
            <Input
              id={`${app.app_id}-edit-extra-ids`}
              value={extraIds}
              onChange={(e) => setExtraIds(e.target.value)}
            />
          </Field>
          <div className="text-sm">
            <span className="font-medium">Repos: </span>
            {repos.length ? repos.join(" ") : "none"}
          </div>
          {mutation.isError && (
            <p className="text-flathub-electric-red text-sm">
              Failed to update scope.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={save}
              disabled={splitList(prefixes).length === 0 || mutation.isPending}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="text-sm">
            <span className="font-medium">Prefixes: </span>
            {currentPrefixes.length ? currentPrefixes.join(" ") : "none"}
          </div>
          <div className="text-sm">
            <span className="font-medium">Extra IDs: </span>
            {currentExtraIds.length ? currentExtraIds.join(" ") : "none"}
          </div>
          <div className="text-sm">
            <span className="font-medium">Repos: </span>
            {repos.length ? repos.join(" ") : "none"}
          </div>
          <div>
            <Button size="sm" variant="outline" onClick={startEdit}>
              Edit scope
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function MaintainersSection({
  app,
  onChanged,
}: {
  app: ManagedAppResponse
  onChanged: () => void
}) {
  const [addUserId, setAddUserId] = useState("")
  const [confirmRemove, setConfirmRemove] = useState<{
    userId: number
    displayName: string
  } | null>(null)

  const addMutation = useAddMaintainerDirectUploadAppsAppIdMaintainersPost({
    axios: { withCredentials: true },
  })
  const removeMutation =
    useRemoveMaintainerDirectUploadAppsAppIdMaintainersUserIdDelete({
      axios: { withCredentials: true },
    })
  const setPrimaryMutation =
    useSetPrimaryMaintainerDirectUploadAppsAppIdMaintainersUserIdSetPrimaryPost(
      {
        axios: { withCredentials: true },
      },
    )

  const busy =
    addMutation.isPending ||
    removeMutation.isPending ||
    setPrimaryMutation.isPending

  const sorted = [...app.maintainers].sort((a, b) =>
    a.is_primary === b.is_primary ? 0 : a.is_primary ? -1 : 1,
  )

  return (
    <div className="border-t pt-3 flex flex-col gap-2">
      <span className="text-sm font-semibold">Maintainers</span>
      <div className="flex flex-col gap-1.5">
        {sorted.length === 0 && (
          <span className="text-sm text-muted-foreground">none</span>
        )}
        {sorted.map((m) => (
          <div key={m.id} className="flex items-center gap-2 text-sm">
            <span className="w-[200px] truncate">{m.display_name ?? m.id}</span>
            {m.is_primary ? (
              <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
                primary
              </span>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setPrimaryMutation.mutate(
                      { appId: app.app_id, userId: m.id },
                      { onSuccess: onChanged },
                    )
                  }
                  disabled={busy}
                >
                  Make primary
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    setConfirmRemove({
                      userId: m.id,
                      displayName: m.display_name ?? String(m.id),
                    })
                  }
                  disabled={busy}
                >
                  Remove
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-end gap-2 mt-1">
        <Field
          id={`${app.app_id}-add-maintainer`}
          label="Add maintainer user ID"
        >
          <Input
            id={`${app.app_id}-add-maintainer`}
            type="number"
            placeholder="123"
            className="!h-8"
            value={addUserId}
            onChange={(e) => setAddUserId(e.target.value)}
          />
        </Field>
        <Button
          size="sm"
          onClick={() => {
            addMutation.mutate(
              { appId: app.app_id, data: { user_id: Number(addUserId) } },
              {
                onSuccess: () => {
                  setAddUserId("")
                  onChanged()
                },
              },
            )
          }}
          disabled={
            !addUserId.trim() || Number.isNaN(Number(addUserId)) || busy
          }
        >
          Add
        </Button>
      </div>
      {(addMutation.isError ||
        removeMutation.isError ||
        setPrimaryMutation.isError) && (
        <p className="text-flathub-electric-red text-sm">
          Failed to update maintainers.
        </p>
      )}
      <ConfirmDialog
        isVisible={confirmRemove !== null}
        prompt="Remove maintainer"
        description={`Remove ${confirmRemove?.displayName ?? ""} as a maintainer of ${app.app_id}?`}
        action="Remove"
        actionVariant="destructive"
        onConfirmed={() => {
          if (!confirmRemove) return
          removeMutation.mutate(
            { appId: app.app_id, userId: confirmRemove.userId },
            {
              onSuccess: () => {
                setConfirmRemove(null)
                onChanged()
              },
            },
          )
        }}
        onCancelled={() => setConfirmRemove(null)}
      />
    </div>
  )
}

function ManagedAppCard({
  app,
  onChanged,
}: {
  app: ManagedAppResponse
  onChanged: () => void
}) {
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const [confirmSwitchOff, setConfirmSwitchOff] = useState(false)

  const revokeMutation = useRevokeTokensDirectUploadAppsAppIdRevokeTokensPost({
    axios: { withCredentials: true },
  })
  const switchOffMutation = useSwitchOffDirectUploadDirectUploadAppsAppIdDelete(
    {
      axios: { withCredentials: true },
    },
  )

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {app.app_id}
            {app.archived && (
              <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
                archived
              </span>
            )}
            {app.scope && (
              <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
                runtime
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <MaintainersSection app={app} onChanged={onChanged} />

          <RuntimeScopeSection app={app} onChanged={onChanged} />

          <div className="flex gap-3 flex-wrap border-t pt-3">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmRevoke(true)}
              disabled={revokeMutation.isPending}
            >
              Revoke all tokens
            </Button>
            {!app.scope && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setConfirmSwitchOff(true)}
                disabled={switchOffMutation.isPending}
              >
                Switch off direct upload
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        isVisible={confirmRevoke}
        prompt="Revoke all tokens"
        description={`Revoke all upload tokens for ${app.app_id}? Maintainers can mint new tokens afterward.`}
        action="Revoke all tokens"
        actionVariant="destructive"
        onConfirmed={() => {
          setConfirmRevoke(false)
          revokeMutation.mutate({ appId: app.app_id }, { onSuccess: onChanged })
        }}
        onCancelled={() => setConfirmRevoke(false)}
      />

      {!app.scope && (
        <ConfirmDialog
          isVisible={confirmSwitchOff}
          prompt="Switch off direct upload"
          description={`Switch off direct upload for ${app.app_id}? This will hard-delete the DirectUploadApp record, all developers, pending invites, the runtime scope (if any), and revoke all upload tokens. The app will fall back to GitHub/verification ownership. This cannot be undone.`}
          action="Switch off direct upload"
          actionVariant="destructive"
          onConfirmed={() => {
            setConfirmSwitchOff(false)
            switchOffMutation.mutate(
              { appId: app.app_id },
              { onSuccess: onChanged },
            )
          }}
          onCancelled={() => setConfirmSwitchOff(false)}
        />
      )}
    </>
  )
}

export default function DirectUploadsClient() {
  const query = useListDirectUploadAppsDirectUploadAppsGet({
    axios: { withCredentials: true },
  })

  return (
    <AdminLayoutClient
      condition={(info: GetUserinfoAuthUserinfoGet200) =>
        info.permissions.some((a) => a === Permission["modify-users"])
      }
    >
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <div className="space-y-8">
          <h1 className="mt-8 text-4xl font-extrabold">Direct-upload apps</h1>
          <div className="px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
            <SwitchToDirectUploadForm onCreated={() => query.refetch()} />

            {query.isLoading && <Spinner size="m" />}

            {query.isSuccess &&
              query.data.data.map((app) => (
                <ManagedAppCard
                  key={`${app.app_id}:${app.maintainers.map((m) => `${m.id}-${m.is_primary ? "P" : "S"}`).join(",")}:${app.scope?.prefixes.join(",") ?? ""}:${app.scope?.extra_ids.join(",") ?? ""}:${app.scope?.repos.join(",") ?? ""}`}
                  app={app}
                  onChanged={() => query.refetch()}
                />
              ))}
          </div>
        </div>
      </div>
    </AdminLayoutClient>
  )
}
