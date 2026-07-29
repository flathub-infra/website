"use client"

import { useQueryClient } from "@tanstack/react-query"
import { type FormEvent, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import ConfirmDialog from "src/components/ConfirmDialog"
import Modal from "src/components/Modal"
import AdminLayoutClient from "src/components/AdminLayoutClient"
import Spinner from "src/components/Spinner"
import { Link } from "src/i18n/navigation"
import {
  createOidcClientAdminOidcClientsPost,
  getGetOidcClientAdminOidcClientsClientIdGetQueryKey,
  getListOidcClientsAdminOidcClientsGetQueryKey,
  GetUserinfoAuthUserinfoGet200,
  OidcClientCreate,
  OidcClientPatch,
  Permission,
  rotateOidcClientSecretAdminOidcClientsClientIdRotateSecretPost,
  useDisableOidcClientAdminOidcClientsClientIdDelete,
  useGetOidcClientAdminOidcClientsClientIdGet,
  useListOidcClientsAdminOidcClientsGet,
  useUpdateOidcClientAdminOidcClientsClientIdPatch,
} from "src/codegen"

const SCOPE_OPTIONS = ["openid", "profile", "email", "offline_access"] as const

function emptyCreateForm(): OidcClientCreate {
  return {
    name: "",
    description: "",
    redirect_uris: [""],
    allowed_scopes: ["openid"],
    refresh_tokens_enabled: false,
    require_pkce: true,
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error !== null) {
    const response = Reflect.get(error, "response")
    const data =
      response && typeof response === "object"
        ? Reflect.get(response, "data")
        : undefined
    const detail =
      data && typeof data === "object" ? Reflect.get(data, "detail") : undefined
    if (typeof detail === "string") return detail
  }
  return "The request could not be completed. Please try again."
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString()
}

export default function OidcClientsClient() {
  const queryClient = useQueryClient()
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [createShown, setCreateShown] = useState(false)
  const [createForm, setCreateForm] =
    useState<OidcClientCreate>(emptyCreateForm)
  const [createPending, setCreatePending] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [secretAcknowledged, setSecretAcknowledged] = useState(false)
  const [secretCopied, setSecretCopied] = useState(false)
  const [rotateConfirmShown, setRotateConfirmShown] = useState(false)
  const [rotatePending, setRotatePending] = useState(false)
  const [rotateError, setRotateError] = useState<string | null>(null)
  const [disableConfirmShown, setDisableConfirmShown] = useState(false)
  const [editForm, setEditForm] = useState<OidcClientPatch>({})
  const [updateSuccess, setUpdateSuccess] = useState(false)

  const listQuery = useListOidcClientsAdminOidcClientsGet({
    axios: { withCredentials: true },
  })
  const detailQuery = useGetOidcClientAdminOidcClientsClientIdGet(
    selectedClientId ?? "",
    {
      axios: { withCredentials: true },
      query: { enabled: selectedClientId !== null },
    },
  )
  const updateMutation = useUpdateOidcClientAdminOidcClientsClientIdPatch({
    axios: { withCredentials: true },
  })
  const disableMutation = useDisableOidcClientAdminOidcClientsClientIdDelete({
    axios: { withCredentials: true },
  })

  const detail = detailQuery.data?.data

  useEffect(() => {
    if (!detail) return
    setEditForm({
      name: detail.name,
      description: detail.description,
      redirect_uris: [...detail.redirect_uris],
      allowed_scopes: [...detail.allowed_scopes],
      refresh_tokens_enabled: detail.refresh_tokens_enabled,
      require_pkce: detail.require_pkce,
    })
    setUpdateSuccess(false)
  }, [detail?.client_id, detail?.updated_at])

  const invalidateClientQueries = async (clientId?: string) => {
    await queryClient.invalidateQueries({
      queryKey: getListOidcClientsAdminOidcClientsGetQueryKey(),
    })
    if (clientId) {
      await queryClient.invalidateQueries({
        queryKey: getGetOidcClientAdminOidcClientsClientIdGetQueryKey(clientId),
      })
    }
  }

  const closeSecret = () => {
    if (!secretAcknowledged) return
    setSecret(null)
    setSecretAcknowledged(false)
    setSecretCopied(false)
  }

  const handleCreate = async (event?: FormEvent) => {
    event?.preventDefault()
    if (
      !createForm.name.trim() ||
      createForm.redirect_uris.some((uri) => !uri.trim()) ||
      createPending
    )
      return
    setCreatePending(true)
    setCreateError(null)
    try {
      const response = await createOidcClientAdminOidcClientsPost(
        {
          ...createForm,
          name: createForm.name.trim(),
          redirect_uris: createForm.redirect_uris
            .map((uri) => uri.trim())
            .filter(Boolean),
        },
        { withCredentials: true },
      )
      await invalidateClientQueries(response.data.client_id)
      setSelectedClientId(response.data.client_id)
      setCreateForm(emptyCreateForm())
      setCreateShown(false)
      setSecret(response.data.client_secret)
      setSecretAcknowledged(false)
      setSecretCopied(false)
    } catch (error) {
      setCreateError(errorMessage(error))
    } finally {
      setCreatePending(false)
    }
  }

  const handleRotate = async () => {
    if (!selectedClientId || rotatePending) return
    setRotatePending(true)
    setRotateError(null)
    try {
      const response =
        await rotateOidcClientSecretAdminOidcClientsClientIdRotateSecretPost(
          selectedClientId,
          { withCredentials: true },
        )
      await invalidateClientQueries(selectedClientId)
      setRotateConfirmShown(false)
      setSecret(response.data.client_secret)
      setSecretAcknowledged(false)
      setSecretCopied(false)
    } catch (error) {
      setRotateError(errorMessage(error))
    } finally {
      setRotatePending(false)
    }
  }

  const handleUpdate = async (event: FormEvent) => {
    event.preventDefault()
    if (!selectedClientId || updateMutation.isPending) return
    setUpdateSuccess(false)
    try {
      await updateMutation.mutateAsync({
        clientId: selectedClientId,
        data: {
          ...editForm,
          name:
            typeof editForm.name === "string"
              ? editForm.name.trim()
              : editForm.name,
          redirect_uris: editForm.redirect_uris
            ?.map((uri) => uri.trim())
            .filter(Boolean),
        },
      })
      await invalidateClientQueries(selectedClientId)
      setUpdateSuccess(true)
    } catch {
      // The mutation error is rendered below.
    }
  }

  const handleDisable = () => {
    if (!selectedClientId || disableMutation.isPending) return
    disableMutation.mutate(
      { clientId: selectedClientId },
      {
        onSuccess: async () => {
          setDisableConfirmShown(false)
          await invalidateClientQueries(selectedClientId)
        },
      },
    )
  }

  const setCreateScope = (scope: string, checked: boolean) => {
    setCreateForm((current) => ({
      ...current,
      allowed_scopes: checked
        ? Array.from(new Set([...current.allowed_scopes, scope]))
        : current.allowed_scopes.filter((item) => item !== scope),
    }))
  }

  const setEditScope = (scope: string, checked: boolean) => {
    setEditForm((current) => ({
      ...current,
      allowed_scopes: checked
        ? Array.from(new Set([...(current.allowed_scopes ?? []), scope]))
        : (current.allowed_scopes ?? []).filter((item) => item !== scope),
    }))
  }

  return (
    <AdminLayoutClient
      condition={(info: GetUserinfoAuthUserinfoGet200) =>
        info.permissions.some(
          (permission) => permission === Permission["manage-oidc-clients"],
        )
      }
    >
      <div className="mx-auto w-11/12 max-w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <div className="space-y-8 py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-extrabold">OIDC clients</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Manage registered clients and their access to Flathub.
              </p>
            </div>
            <Button
              onClick={() => {
                setCreateError(null)
                setCreateShown(true)
              }}
            >
              Register client
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Users authenticating through OIDC need the <code>oidc</code> role.
            Manage roles in{" "}
            <Link className="underline" href="/admin/roles">
              roles
            </Link>{" "}
            and users in{" "}
            <Link className="underline" href="/admin/users">
              users
            </Link>
            .
          </p>

          {listQuery.isLoading && <Spinner size="m" />}
          {listQuery.isError && (
            <p className="text-sm text-destructive">
              {errorMessage(listQuery.error)}
            </p>
          )}
          {listQuery.isSuccess && (
            <Card>
              <CardHeader>
                <CardTitle>Registered clients</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-3 py-3 font-medium">Name</th>
                      <th className="px-3 py-3 font-medium">Client ID</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                      <th className="px-3 py-3 font-medium">Redirect URIs</th>
                      <th className="px-3 py-3 font-medium">Scopes</th>
                      <th className="px-3 py-3 font-medium">Created</th>
                      <th className="px-3 py-3 font-medium">Active tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listQuery.data.data.map((client) => (
                      <tr
                        key={client.client_id}
                        className={`cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/40 ${selectedClientId === client.client_id ? "bg-muted/40" : ""}`}
                        onClick={() => setSelectedClientId(client.client_id)}
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            setSelectedClientId(client.client_id)
                          }
                        }}
                      >
                        <td className="px-3 py-3 font-medium">{client.name}</td>
                        <td className="px-3 py-3 font-mono text-xs">
                          {client.client_id}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${client.enabled ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200" : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}
                          >
                            {client.enabled ? "Enabled" : "Disabled"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {client.redirect_uris.length}
                        </td>
                        <td className="px-3 py-3">
                          {client.allowed_scopes.join(", ") || "—"}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {formatDate(client.created_at)}
                        </td>
                        <td className="px-3 py-3">
                          {client.active_token_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {listQuery.data.data.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No OIDC clients registered.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {selectedClientId && (
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-4">
                <CardTitle>Client details</CardTitle>
                {detail?.enabled && (
                  <Button
                    variant="destructive"
                    onClick={() => setDisableConfirmShown(true)}
                  >
                    Disable client
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {detailQuery.isLoading && <Spinner size="m" />}
                {detailQuery.isError && (
                  <p className="text-sm text-destructive">
                    {errorMessage(detailQuery.error)}
                  </p>
                )}
                {detail && (
                  <form className="space-y-6" onSubmit={handleUpdate}>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label
                        htmlFor="edit-name"
                        className="space-y-2 text-sm font-medium"
                      >
                        Name
                        <Input
                          id="edit-name"
                          required
                          value={editForm.name ?? ""}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label
                        htmlFor="edit-client-id"
                        className="space-y-2 text-sm font-medium"
                      >
                        Client ID
                        <Input
                          id="edit-client-id"
                          readOnly
                          value={detail.client_id}
                        />
                      </label>
                    </div>
                    <label
                      htmlFor="edit-description"
                      className="block space-y-2 text-sm font-medium"
                    >
                      Description
                      <Input
                        id="edit-description"
                        value={editForm.description ?? ""}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Redirect URIs</p>
                      {(editForm.redirect_uris ?? []).map((uri, index) => (
                        <div className="flex gap-2" key={index}>
                          <Input
                            required
                            value={uri}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                redirect_uris: (
                                  current.redirect_uris ?? []
                                ).map((item, itemIndex) =>
                                  itemIndex === index
                                    ? event.target.value
                                    : item,
                                ),
                              }))
                            }
                          />
                          <Button
                            type="button"
                            variant="outline"
                            disabled={
                              (editForm.redirect_uris ?? []).length === 1
                            }
                            onClick={() =>
                              setEditForm((current) => ({
                                ...current,
                                redirect_uris: (
                                  current.redirect_uris ?? []
                                ).filter((_, itemIndex) => itemIndex !== index),
                              }))
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          setEditForm((current) => ({
                            ...current,
                            redirect_uris: [
                              ...(current.redirect_uris ?? []),
                              "",
                            ],
                          }))
                        }
                      >
                        Add redirect URI
                      </Button>
                    </div>
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Allowed scopes</p>
                      <div className="flex flex-wrap gap-4">
                        {SCOPE_OPTIONS.map((scope) => (
                          <label
                            className="flex items-center gap-2 text-sm"
                            htmlFor={`edit-scope-${scope}`}
                            key={scope}
                          >
                            <Checkbox
                              id={`edit-scope-${scope}`}
                              checked={(editForm.allowed_scopes ?? []).includes(
                                scope,
                              )}
                              onCheckedChange={(checked) =>
                                setEditScope(scope, checked === true)
                              }
                            />
                            {scope}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-6">
                      <label
                        className="flex items-center gap-2 text-sm"
                        htmlFor="edit-refresh-tokens"
                      >
                        <Checkbox
                          id="edit-refresh-tokens"
                          checked={editForm.refresh_tokens_enabled === true}
                          onCheckedChange={(checked) =>
                            setEditForm((current) => ({
                              ...current,
                              refresh_tokens_enabled: checked === true,
                            }))
                          }
                        />
                        Refresh tokens enabled
                      </label>
                      <label
                        className="flex items-center gap-2 text-sm"
                        htmlFor="edit-require-pkce"
                      >
                        <Checkbox
                          id="edit-require-pkce"
                          checked={editForm.require_pkce === true}
                          onCheckedChange={(checked) =>
                            setEditForm((current) => ({
                              ...current,
                              require_pkce: checked === true,
                            }))
                          }
                        />
                        Require PKCE
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="submit" disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? "Saving…" : "Save changes"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setRotateConfirmShown(true)}
                      >
                        Rotate secret
                      </Button>
                      {updateSuccess && (
                        <span className="text-sm text-green-700 dark:text-green-300">
                          Changes saved.
                        </span>
                      )}
                      {updateMutation.isError && (
                        <span className="text-sm text-destructive">
                          {errorMessage(updateMutation.error)}
                        </span>
                      )}
                    </div>
                    <dl className="grid gap-3 border-t border-border pt-5 text-sm md:grid-cols-3">
                      <div>
                        <dt className="text-muted-foreground">Created</dt>
                        <dd>{formatDate(detail.created_at)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Updated</dt>
                        <dd>{formatDate(detail.updated_at)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Active tokens</dt>
                        <dd>{detail.active_token_count}</dd>
                      </div>
                    </dl>
                  </form>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Modal
        shown={createShown}
        title="Register OIDC client"
        description="The client secret will be shown once after registration."
        onClose={() => {
          if (!createPending) setCreateShown(false)
        }}
        cancelButton={{
          onClick: () => setCreateShown(false),
          disabled: createPending,
        }}
        submitButton={{
          label: createPending ? "Registering…" : "Register client",
          onClick: () => void handleCreate(),
          disabled:
            createPending ||
            !createForm.name.trim() ||
            createForm.redirect_uris.some((uri) => !uri.trim()),
        }}
        size="lg"
      >
        <form
          className="space-y-5"
          onSubmit={(event) => void handleCreate(event)}
        >
          <label
            htmlFor="create-name"
            className="block space-y-2 text-sm font-medium"
          >
            Name
            <Input
              id="create-name"
              required
              value={createForm.name}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </label>
          <label
            htmlFor="create-description"
            className="block space-y-2 text-sm font-medium"
          >
            Description
            <Input
              id="create-description"
              value={createForm.description ?? ""}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>
          <div className="space-y-3">
            <p className="text-sm font-medium">Redirect URIs</p>
            {createForm.redirect_uris.map((uri, index) => (
              <div className="flex gap-2" key={index}>
                <Input
                  required
                  value={uri}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      redirect_uris: current.redirect_uris.map(
                        (item, itemIndex) =>
                          itemIndex === index ? event.target.value : item,
                      ),
                    }))
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={createForm.redirect_uris.length === 1}
                  onClick={() =>
                    setCreateForm((current) => ({
                      ...current,
                      redirect_uris: current.redirect_uris.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    }))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setCreateForm((current) => ({
                  ...current,
                  redirect_uris: [...current.redirect_uris, ""],
                }))
              }
            >
              Add redirect URI
            </Button>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium">Allowed scopes</p>
            <div className="flex flex-wrap gap-4">
              {SCOPE_OPTIONS.map((scope) => (
                <label
                  className="flex items-center gap-2 text-sm"
                  htmlFor={`create-scope-${scope}`}
                  key={scope}
                >
                  <Checkbox
                    id={`create-scope-${scope}`}
                    checked={createForm.allowed_scopes.includes(scope)}
                    onCheckedChange={(checked) =>
                      setCreateScope(scope, checked === true)
                    }
                  />
                  {scope}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <label
              className="flex items-center gap-2 text-sm"
              htmlFor="create-refresh-tokens"
            >
              <Checkbox
                id="create-refresh-tokens"
                checked={createForm.refresh_tokens_enabled === true}
                onCheckedChange={(checked) =>
                  setCreateForm((current) => ({
                    ...current,
                    refresh_tokens_enabled: checked === true,
                  }))
                }
              />
              Refresh tokens enabled
            </label>
            <label
              className="flex items-center gap-2 text-sm"
              htmlFor="create-require-pkce"
            >
              <Checkbox
                id="create-require-pkce"
                checked={createForm.require_pkce === true}
                onCheckedChange={(checked) =>
                  setCreateForm((current) => ({
                    ...current,
                    require_pkce: checked === true,
                  }))
                }
              />
              Require PKCE
            </label>
          </div>
          {createError && (
            <p className="text-sm text-destructive">{createError}</p>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        isVisible={rotateConfirmShown}
        prompt="Rotate client secret"
        description="Rotating the secret immediately invalidates the old secret. The new secret will be shown only once."
        action={rotatePending ? "Rotating…" : "Rotate secret"}
        actionVariant="destructive"
        submitDisabled={rotatePending}
        onConfirmed={() => void handleRotate()}
        onCancelled={() => {
          if (!rotatePending) setRotateConfirmShown(false)
        }}
      >
        {rotateError && (
          <p className="text-sm text-destructive">{rotateError}</p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        isVisible={disableConfirmShown}
        prompt="Disable OIDC client"
        description="Disabling this client prevents it from starting new OIDC flows. Existing tokens remain visible for auditing."
        action={disableMutation.isPending ? "Disabling…" : "Disable client"}
        actionVariant="destructive"
        submitDisabled={disableMutation.isPending}
        onConfirmed={handleDisable}
        onCancelled={() => {
          if (!disableMutation.isPending) setDisableConfirmShown(false)
        }}
      >
        {disableMutation.isError && (
          <p className="text-sm text-destructive">
            {errorMessage(disableMutation.error)}
          </p>
        )}
      </ConfirmDialog>

      <Modal
        shown={secret !== null}
        title="Save your client secret"
        description="This secret is shown only once and cannot be recovered. Rotation invalidates the old secret."
        onClose={closeSecret}
        cancelButton={{
          label: "Close",
          onClick: closeSecret,
          disabled: !secretAcknowledged,
        }}
        submitButton={{
          label: "I saved the secret",
          onClick: closeSecret,
          disabled: !secretAcknowledged,
        }}
      >
        <div className="space-y-4">
          <p className="text-sm">
            Copy this secret now and store it in a secure password manager.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={secret ?? ""} className="font-mono" />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (secret) {
                  void navigator.clipboard.writeText(secret)
                  setSecretCopied(true)
                }
              }}
            >
              {secretCopied ? "Copied" : "Copy"}
            </Button>
          </div>
          <label
            className="flex items-start gap-2 text-sm"
            htmlFor="secret-acknowledged"
          >
            <Checkbox
              id="secret-acknowledged"
              checked={secretAcknowledged}
              onCheckedChange={(checked) =>
                setSecretAcknowledged(checked === true)
              }
            />
            I understand this secret will not be shown again.
          </label>
        </div>
      </Modal>
    </AdminLayoutClient>
  )
}
