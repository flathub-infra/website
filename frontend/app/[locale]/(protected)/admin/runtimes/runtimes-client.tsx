"use client"

import { useState } from "react"
import ConfirmDialog from "src/components/ConfirmDialog"
import {
  Permission,
  GetUserinfoAuthUserinfoGet200,
  RuntimeResponse,
  useGetRuntimesRuntimesGet,
  useCreateRuntimeRuntimesPost,
  useUpdateRuntimeRuntimesAppIdPatch,
  useRevokeRuntimeTokensRuntimesAppIdRevokeTokensPost,
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

function CreateRuntimeForm({ onCreated }: { onCreated: () => void }) {
  const [appId, setAppId] = useState("")
  const [prefixes, setPrefixes] = useState("")
  const [extraIds, setExtraIds] = useState("")
  const [repos, setRepos] = useState<string[]>(["stable", "beta"])
  const [maintainerId, setMaintainerId] = useState("")

  const mutation = useCreateRuntimeRuntimesPost({
    axios: { withCredentials: true },
  })

  const submit = () => {
    mutation.mutate(
      {
        data: {
          app_id: appId.trim(),
          prefixes: splitList(prefixes),
          extra_ids: splitList(extraIds),
          repos,
          primary_maintainer_user_id: Number(maintainerId),
        },
      },
      {
        onSuccess: () => {
          setAppId("")
          setPrefixes("")
          setExtraIds("")
          setRepos(["stable", "beta"])
          setMaintainerId("")
          onCreated()
        },
      },
    )
  }

  const disabled =
    !appId.trim() ||
    splitList(prefixes).length === 0 ||
    !maintainerId.trim() ||
    Number.isNaN(Number(maintainerId)) ||
    mutation.isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle>Provision a runtime</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Field id="new-app-id" label="Runtime app ID">
          <Input
            id="new-app-id"
            placeholder="org.gnome.Platform"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
          />
        </Field>
        <Field id="new-prefixes" label="Prefixes (space or comma separated)">
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
        <Field id="new-maintainer" label="Primary maintainer user ID">
          <Input
            id="new-maintainer"
            type="number"
            placeholder="123"
            value={maintainerId}
            onChange={(e) => setMaintainerId(e.target.value)}
          />
        </Field>
        {mutation.isError && (
          <p className="text-flathub-electric-red text-sm">
            Failed to provision runtime.
          </p>
        )}
        <div>
          <Button size="lg" onClick={submit} disabled={disabled}>
            Provision
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function RuntimeCard({
  runtime,
  onChanged,
}: {
  runtime: RuntimeResponse
  onChanged: () => void
}) {
  const [prefixes, setPrefixes] = useState(runtime.prefixes.join(" "))
  const [extraIds, setExtraIds] = useState(runtime.extra_ids.join(" "))
  const [repos, setRepos] = useState<string[]>(runtime.repos)
  const [confirmRevoke, setConfirmRevoke] = useState(false)

  const updateMutation = useUpdateRuntimeRuntimesAppIdPatch({
    axios: { withCredentials: true },
  })
  const revokeMutation = useRevokeRuntimeTokensRuntimesAppIdRevokeTokensPost({
    axios: { withCredentials: true },
  })

  const save = () => {
    updateMutation.mutate(
      {
        appId: runtime.app_id,
        data: {
          prefixes: splitList(prefixes),
          extra_ids: splitList(extraIds),
          repos,
        },
      },
      { onSuccess: onChanged },
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{runtime.app_id}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Field id={`${runtime.app_id}-prefixes`} label="Prefixes">
            <Input
              id={`${runtime.app_id}-prefixes`}
              value={prefixes}
              onChange={(e) => setPrefixes(e.target.value)}
            />
          </Field>
          <Field id={`${runtime.app_id}-extra-ids`} label="Extra IDs">
            <Input
              id={`${runtime.app_id}-extra-ids`}
              value={extraIds}
              onChange={(e) => setExtraIds(e.target.value)}
            />
          </Field>
          <RepoCheckboxes
            repos={repos}
            onChange={setRepos}
            idPrefix={runtime.app_id}
          />
          <div className="text-sm">
            <span className="font-medium">Maintainers: </span>
            {runtime.maintainers.length === 0
              ? "none"
              : runtime.maintainers
                  .map(
                    (m) =>
                      `${m.display_name ?? m.id}${
                        m.is_primary ? " (primary)" : ""
                      }`,
                  )
                  .join(", ")}
          </div>
          <div className="flex gap-3">
            <Button
              size="lg"
              onClick={save}
              disabled={
                splitList(prefixes).length === 0 || updateMutation.isPending
              }
            >
              Save
            </Button>
            <Button
              size="lg"
              variant="destructive"
              onClick={() => setConfirmRevoke(true)}
              disabled={revokeMutation.isPending}
            >
              Revoke all tokens
            </Button>
          </div>
        </CardContent>
      </Card>
      <ConfirmDialog
        isVisible={confirmRevoke}
        prompt="Revoke all tokens"
        description={`Revoke all upload tokens for ${runtime.app_id}? Maintainers can mint new tokens afterward.`}
        action="Revoke all tokens"
        actionVariant="destructive"
        onConfirmed={() => {
          setConfirmRevoke(false)
          revokeMutation.mutate(
            { appId: runtime.app_id },
            { onSuccess: onChanged },
          )
        }}
        onCancelled={() => setConfirmRevoke(false)}
      />
    </>
  )
}

export default function RuntimesClient() {
  const query = useGetRuntimesRuntimesGet({
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
          <h1 className="mt-8 text-4xl font-extrabold">Runtimes</h1>
          <div className="px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
            <CreateRuntimeForm onCreated={() => query.refetch()} />

            {query.isLoading && <Spinner size="m" />}

            {query.isSuccess &&
              query.data.data.map((runtime) => (
                <RuntimeCard
                  key={`${runtime.app_id}:${runtime.prefixes.join(",")}:${runtime.extra_ids.join(",")}:${runtime.repos.join(",")}`}
                  runtime={runtime}
                  onChanged={() => query.refetch()}
                />
              ))}
          </div>
        </div>
      </div>
    </AdminLayoutClient>
  )
}
