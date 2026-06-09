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
  useSetRuntimeScopeDirectUploadAppsAppIdScopePut,
  useRemoveRuntimeScopeDirectUploadAppsAppIdScopeDelete,
  useRevokeTokensDirectUploadAppsAppIdRevokeTokensPost,
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
  const hasScope = app.scope !== null && app.scope !== undefined

  const [prefixes, setPrefixes] = useState(
    hasScope ? app.scope!.prefixes.join(" ") : "",
  )
  const [extraIds, setExtraIds] = useState(
    hasScope ? app.scope!.extra_ids.join(" ") : "",
  )
  const [repos, setRepos] = useState<string[]>(
    hasScope ? app.scope!.repos : ["stable", "beta"],
  )
  const [confirmRemove, setConfirmRemove] = useState(false)

  const saveMutation = useSetRuntimeScopeDirectUploadAppsAppIdScopePut({
    axios: { withCredentials: true },
  })
  const removeMutation = useRemoveRuntimeScopeDirectUploadAppsAppIdScopeDelete({
    axios: { withCredentials: true },
  })

  if (hasScope) {
    return (
      <div className="border-t pt-3 flex flex-col gap-3">
        <span className="text-sm font-semibold">Runtime scope</span>
        <Field id={`${app.app_id}-prefixes`} label="Prefixes">
          <Input
            id={`${app.app_id}-prefixes`}
            value={prefixes}
            onChange={(e) => setPrefixes(e.target.value)}
          />
        </Field>
        <Field id={`${app.app_id}-extra-ids`} label="Extra IDs">
          <Input
            id={`${app.app_id}-extra-ids`}
            value={extraIds}
            onChange={(e) => setExtraIds(e.target.value)}
          />
        </Field>
        <RepoCheckboxes
          repos={repos}
          onChange={setRepos}
          idPrefix={app.app_id}
        />
        <div className="flex gap-3">
          <Button
            size="sm"
            onClick={() =>
              saveMutation.mutate(
                {
                  appId: app.app_id,
                  data: {
                    prefixes: splitList(prefixes),
                    extra_ids: splitList(extraIds),
                    repos,
                  },
                },
                { onSuccess: onChanged },
              )
            }
            disabled={
              splitList(prefixes).length === 0 || saveMutation.isPending
            }
          >
            Save scope
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setConfirmRemove(true)}
            disabled={removeMutation.isPending}
          >
            Remove runtime scope
          </Button>
        </div>
        <ConfirmDialog
          isVisible={confirmRemove}
          prompt="Remove runtime scope"
          description={`Remove the runtime scope from ${app.app_id}? The app will remain a direct-upload app but will no longer be treated as a runtime.`}
          action="Remove scope"
          actionVariant="destructive"
          onConfirmed={() => {
            setConfirmRemove(false)
            removeMutation.mutate(
              { appId: app.app_id },
              { onSuccess: onChanged },
            )
          }}
          onCancelled={() => setConfirmRemove(false)}
        />
      </div>
    )
  }

  return null
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
          <div className="text-sm">
            <span className="font-medium">Maintainers: </span>
            {app.maintainers.length === 0
              ? "none"
              : app.maintainers
                  .map(
                    (m) =>
                      `${m.display_name ?? m.id}${m.is_primary ? " (primary)" : ""}`,
                  )
                  .join(", ")}
          </div>

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
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmSwitchOff(true)}
              disabled={switchOffMutation.isPending}
            >
              Switch off direct upload
            </Button>
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
                  key={`${app.app_id}:${app.scope?.prefixes.join(",") ?? ""}:${app.scope?.extra_ids.join(",") ?? ""}:${app.scope?.repos.join(",") ?? ""}`}
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
