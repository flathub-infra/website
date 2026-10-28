"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { isAxiosError } from "axios"
import { useTranslations } from "next-intl"
import { Eye, Pencil, Plus, Wand2 } from "lucide-react"
import {
  PermissionRuleEntry as Rule,
  PermissionRuleInput as RuleInput,
  PermissionRuleInputDecision as Decision,
  PermissionRuleInputPermissionGroup as Group,
  PermissionRuleConflict as Conflict,
  PermissionRuleMatch as Match,
  PermissionRulePreview as Preview,
  getListPermissionRulesModerationPermissionRulesGetQueryKey,
  useApplyPermissionRulesModerationPermissionRulesApplyPost,
  useCreatePermissionRuleModerationPermissionRulesPost,
  useListPermissionRulesModerationPermissionRulesGet,
  usePreviewPermissionRulesModerationPermissionRulesPreviewPost,
  useUpdatePermissionRuleModerationPermissionRulesRuleIdPut,
} from "src/codegen"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Link } from "src/i18n/navigation"
import { cn } from "@/lib/utils"
import ConfirmDialog from "../ConfirmDialog"
import InlineError from "../InlineError"
import Modal from "../Modal"
import Spinner from "../Spinner"
import OutcomeBadge from "./PermissionOutcomeBadge"
import { ruleLabel } from "./permission-rule-label"
import {
  permissionReviewSurface,
  permissionReviewTheme,
} from "./permission-review-styles"

const BUS_GROUPS: string[] = [Group.Session_Bus_Policy, Group.System_Bus_Policy]
const BUS_LEVELS = ["none", "see", "talk", "own"]

const emptyRule: RuleInput = {
  decision: Decision.approved,
  permission_group: Group.Session_Bus_Policy,
  match_type: "destination",
  before: null,
  removed: null,
  added: null,
  required: [],
  key: "",
  value: "talk",
  rationale: "",
  enabled: true,
}

const ruleInput = (rule: Rule): RuleInput => ({
  decision: rule.decision,
  permission_group: rule.permission_group,
  match_type: rule.match_type,
  before: rule.before,
  removed: rule.removed ?? null,
  added: rule.added ?? null,
  required: rule.required ?? [],
  key: rule.key,
  value: rule.value,
  rationale: rule.rationale,
  enabled: rule.enabled,
})

const errorText = (e: Error) => {
  const detail: unknown = isAxiosError(e) && e.response?.data?.detail
  return typeof detail === "string" ? detail.replaceAll("_", " ") : e.message
}

const MatchList = ({ items }: { items: (Match | Conflict)[] }) => (
  <ul className="flex flex-col gap-1.5">
    {items.map((item) => (
      <li
        key={item.assessment_id}
        className="flex flex-wrap items-center gap-2"
      >
        <OutcomeBadge outcome={item.decision} />
        <Link
          href={`/admin/moderation/permissions/${item.assessment_id}`}
          className="font-mono text-xs [overflow-wrap:anywhere]"
        >
          {item.app_id} #{item.assessment_id}
        </Link>
        {"moderator_decision" in item && (
          <span className="text-xs text-muted-foreground">
            moderator {item.moderator_decision}
          </span>
        )}
      </li>
    ))}
  </ul>
)

const PreviewResult = ({ preview }: { preview: Preview }) => (
  <div
    className={cn(permissionReviewTheme, "flex flex-col gap-3 text-sm")}
    role="status"
  >
    <p className="mb-0">
      {preview.pending.length === 1
        ? "1 pending review would be decided."
        : `${preview.pending.length} pending reviews would be decided.`}
    </p>
    <MatchList items={preview.pending} />
    {preview.conflicts.length > 0 && (
      <>
        <p className="mb-0 font-medium text-destructive">
          {preview.conflicts.length === 1
            ? "1 moderator decision disagrees with these rules."
            : `${preview.conflicts.length} moderator decisions disagree with these rules.`}
        </p>
        <MatchList items={preview.conflicts} />
      </>
    )}
  </div>
)

const RuleEditor = ({
  rule,
  onClose,
}: {
  rule: Rule | null
  onClose: () => void
}) => {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<RuleInput>(
    rule ? ruleInput(rule) : emptyRule,
  )
  const [preview, setPreview] = useState<{ key: string; data: Preview }>()
  const [error, setError] = useState<string>()
  const options = {
    axios: { withCredentials: true },
    mutation: { onError: (e: Error) => setError(errorText(e)) },
  }
  const previewMutation =
    usePreviewPermissionRulesModerationPermissionRulesPreviewPost(options)
  const createMutation =
    useCreatePermissionRuleModerationPermissionRulesPost(options)
  const updateMutation =
    useUpdatePermissionRuleModerationPermissionRulesRuleIdPut(options)

  const trimmed = {
    ...draft,
    key: draft.key.trim(),
    before: draft.before == null ? null : draft.before.trim(),
    value: draft.value === null ? null : draft.value.trim(),
    removed: draft.removed?.map((entry) => entry.trim()) ?? null,
    added: draft.added?.map((entry) => entry.trim()) ?? null,
    required: draft.required?.map((entry) => entry.trim()) ?? [],
    rationale: draft.rationale.trim(),
  }
  const bus = BUS_GROUPS.includes(draft.permission_group)
  const transition = draft.match_type === "transition"
  const grouped = draft.match_type === "grouped-delta"
  const groupedKey =
    draft.permission_group === Group.USB_Devices ||
    (draft.permission_group === Group.Context &&
      [
        "shared",
        "sockets",
        "devices",
        "features",
        "filesystems",
        "persistent",
      ].includes(trimmed.key))
  const removed = trimmed.removed ?? []
  const added = trimmed.added ?? []
  const required = trimmed.required
  const validEntries = [removed, added, required].every(
    (entries) =>
      entries.every((entry) => entry.length > 0) &&
      new Set(entries).size === entries.length,
  )
  const complete = Boolean(
    trimmed.key &&
    trimmed.rationale &&
    (grouped
      ? groupedKey &&
        trimmed.before === null &&
        trimmed.value === null &&
        trimmed.removed !== null &&
        trimmed.added !== null &&
        removed.length + added.length > 0 &&
        validEntries &&
        !removed.some((entry) => added.includes(entry)) &&
        !required.some((entry) => [...removed, ...added].includes(entry))
      : trimmed.removed === null &&
        trimmed.added === null &&
        [trimmed.before, trimmed.value].every(
          (value) =>
            value === null ||
            (value.length > 0 && (!bus || BUS_LEVELS.includes(value))),
        ) &&
        (transition
          ? trimmed.before !== trimmed.value
          : trimmed.before === null && trimmed.value !== null)),
  )
  const key = JSON.stringify(trimmed)
  const current = preview?.key === key ? preview.data : undefined
  const pending =
    previewMutation.isPending ||
    createMutation.isPending ||
    updateMutation.isPending

  const set = (changes: Partial<RuleInput>) =>
    setDraft((previous) => ({ ...previous, ...changes }))

  const runPreview = () => {
    setError(undefined)
    previewMutation.mutate(
      { data: { ...trimmed, id: rule?.id ?? null } },
      { onSuccess: (response) => setPreview({ key, data: response.data }) },
    )
  }

  const save = async () => {
    setError(undefined)
    if (rule) {
      await updateMutation.mutateAsync({ ruleId: rule.id, data: trimmed })
    } else {
      await createMutation.mutateAsync({ data: trimmed })
    }
    await queryClient.invalidateQueries({
      queryKey: getListPermissionRulesModerationPermissionRulesGetQueryKey(),
    })
    onClose()
  }

  return (
    <Modal
      shown={true}
      size="lg"
      title={rule ? "Edit permission rule" : "New permission rule"}
      description="Rules decide new permission changes automatically. A moderator decision on the same change always wins."
      onClose={onClose}
      cancelButton={{ onClick: onClose, disabled: pending }}
      submitButton={{
        label:
          current && current.conflicts.length > 0
            ? "Save despite conflicts"
            : "Save",
        variant:
          current && current.conflicts.length > 0 ? "destructive" : "default",
        disabled: pending || !complete || !current,
        onClick: () => save().catch(() => undefined),
      }}
    >
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="rule-decision">Decision</FieldLabel>
            <Select
              value={draft.decision}
              onValueChange={(value) =>
                set({ decision: value as RuleInput["decision"] })
              }
            >
              <SelectTrigger id="rule-decision" className="capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {Object.values(Decision).map((value) => (
                    <SelectItem
                      key={value}
                      value={value}
                      className="capitalize"
                    >
                      {value}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="rule-group">Group</FieldLabel>
            <Select
              value={draft.permission_group}
              onValueChange={(value) =>
                set({
                  permission_group: value as RuleInput["permission_group"],
                  key: "",
                  match_type:
                    grouped && BUS_GROUPS.includes(value)
                      ? "destination"
                      : draft.match_type,
                  before: null,
                  value:
                    grouped && !BUS_GROUPS.includes(value)
                      ? null
                      : BUS_GROUPS.includes(value)
                        ? "talk"
                        : "",
                  removed: grouped && !BUS_GROUPS.includes(value) ? [] : null,
                  added: grouped && !BUS_GROUPS.includes(value) ? [] : null,
                  required: [],
                })
              }
            >
              <SelectTrigger id="rule-group">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {Object.values(Group).map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="rule-match-type">Match</FieldLabel>
            <Select
              value={draft.match_type}
              onValueChange={(value) =>
                set({
                  match_type: value as RuleInput["match_type"],
                  before: null,
                  value:
                    value === "grouped-delta"
                      ? null
                      : (draft.value ?? (bus ? "talk" : "")),
                  removed: value === "grouped-delta" ? [] : null,
                  added: value === "grouped-delta" ? [] : null,
                  required: [],
                })
              }
            >
              <SelectTrigger id="rule-match-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="destination">Destination-only</SelectItem>
                  <SelectItem value="transition">Exact transition</SelectItem>
                  <SelectItem value="grouped-delta" disabled={bus}>
                    Grouped delta
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="rule-key">
              {bus ? "Bus name" : "Key"}
            </FieldLabel>
            <Input
              id="rule-key"
              className="font-mono"
              value={draft.key}
              placeholder={bus ? "org.kde.StatusNotifierWatcher" : "sockets"}
              onChange={(e) => set({ key: e.target.value })}
            />
            {grouped && (
              <FieldDescription>
                {draft.permission_group === Group.Context
                  ? "Use shared, sockets, devices, features, filesystems, or persistent."
                  : "Match a USB device list."}
              </FieldDescription>
            )}
          </Field>
          {grouped
            ? (["removed", "added", "required"] as const).map((endpoint) => (
                <Field key={endpoint}>
                  <FieldLabel htmlFor={`rule-${endpoint}`}>
                    {endpoint === "removed"
                      ? "Removed entries"
                      : endpoint === "added"
                        ? "Added entries"
                        : "Required unchanged entries"}
                  </FieldLabel>
                  <Textarea
                    id={`rule-${endpoint}`}
                    className="min-h-24 font-mono"
                    value={(draft[endpoint] ?? []).join("\n")}
                    aria-describedby={`rule-${endpoint}-help`}
                    onChange={(event) =>
                      set({
                        [endpoint]:
                          event.target.value === ""
                            ? []
                            : event.target.value.split("\n"),
                      })
                    }
                  />
                  <FieldDescription id={`rule-${endpoint}-help`}>
                    {endpoint === "required"
                      ? "One entry per line. Each entry must remain present before and after the change, and cannot appear in either changed list."
                      : "One entry per line, in order. Leave empty for no entries. Entries must be unique and cannot appear in both lists."}
                  </FieldDescription>
                </Field>
              ))
            : (transition
                ? (["before", "value"] as const)
                : (["value"] as const)
              ).map((endpoint) => {
                const value = draft[endpoint] ?? null
                const prefix = transition
                  ? endpoint === "before"
                    ? "Before "
                    : "After "
                  : ""
                const label = `${prefix}${bus ? "policy" : "entry"}`
                const fieldLabel =
                  label.charAt(0).toUpperCase() + label.slice(1)
                const id = `rule-${endpoint}`
                return (
                  <Field key={endpoint}>
                    <FieldLabel
                      htmlFor={bus || !transition ? id : `${id}-presence`}
                    >
                      {fieldLabel}
                    </FieldLabel>
                    {bus ? (
                      <Select
                        value={value ?? "__absent"}
                        onValueChange={(selected) =>
                          set({
                            [endpoint]:
                              selected === "__absent" ? null : selected,
                          })
                        }
                      >
                        <SelectTrigger id={id}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {transition && (
                              <SelectItem value="__absent">Absent</SelectItem>
                            )}
                            {BUS_LEVELS.map((level) => (
                              <SelectItem key={level} value={level}>
                                {level}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    ) : (
                      <>
                        {transition && (
                          <Select
                            value={value === null ? "absent" : "present"}
                            onValueChange={(selected) =>
                              set({
                                [endpoint]: selected === "absent" ? null : "",
                              })
                            }
                          >
                            <SelectTrigger id={`${id}-presence`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="absent">Absent</SelectItem>
                                <SelectItem value="present">Present</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        )}
                        {value !== null && (
                          <Input
                            id={id}
                            aria-label={
                              transition ? `${fieldLabel} value` : undefined
                            }
                            className="font-mono"
                            value={value}
                            placeholder="pulseaudio"
                            onChange={(e) =>
                              set({ [endpoint]: e.target.value })
                            }
                          />
                        )}
                      </>
                    )}
                  </Field>
                )
              })}
        </div>
        {grouped && (
          <FieldDescription>
            Match both ordered lists as one atomic group. Required entries must
            remain unchanged. Other unchanged entries and unrelated changes do
            not affect the match. At least one changed list must contain an
            entry.
          </FieldDescription>
        )}
        <Field>
          <FieldLabel htmlFor="rule-rationale">Rationale</FieldLabel>
          <Textarea
            id="rule-rationale"
            className="min-h-24"
            value={draft.rationale}
            aria-describedby="rule-rationale-help"
            onChange={(e) => set({ rationale: e.target.value })}
          />
          <FieldDescription id="rule-rationale-help">
            Posted on the pull request with each automatic decision.
          </FieldDescription>
        </Field>
        <Field orientation="horizontal">
          <Switch
            id="rule-enabled"
            checked={draft.enabled}
            onCheckedChange={(enabled) => set({ enabled })}
          />
          <FieldLabel htmlFor="rule-enabled">Enabled</FieldLabel>
        </Field>
        <div className="flex flex-col gap-3 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              Preview the rules against pending reviews and past moderator
              decisions before saving.
            </span>
            <Button
              variant="outline"
              disabled={pending || !complete}
              onClick={runPreview}
            >
              <Eye data-icon="inline-start" />
              Preview
            </Button>
          </div>
          {current && <PreviewResult preview={current} />}
          {error && <InlineError error={error} shown={true} />}
        </div>
      </FieldGroup>
    </Modal>
  )
}

const ApplyRules = () => {
  const queryClient = useQueryClient()
  const [preview, setPreview] = useState<Preview>()
  const [status, setStatus] = useState<string>()
  const [error, setError] = useState<string>()
  const options = {
    axios: { withCredentials: true },
    mutation: { onError: (e: Error) => setError(errorText(e)) },
  }
  const previewMutation =
    usePreviewPermissionRulesModerationPermissionRulesPreviewPost(options)
  const applyMutation =
    useApplyPermissionRulesModerationPermissionRulesApplyPost(options)

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        variant="outline"
        disabled={previewMutation.isPending || applyMutation.isPending}
        onClick={() => {
          setError(undefined)
          setStatus(undefined)
          previewMutation.mutate(
            { data: null },
            { onSuccess: (response) => setPreview(response.data) },
          )
        }}
      >
        <Wand2 data-icon="inline-start" />
        Apply to pending reviews
      </Button>
      {status && (
        <span className="text-xs text-muted-foreground" role="status">
          {status}
        </span>
      )}
      {error && <InlineError error={error} shown={true} />}
      <ConfirmDialog
        isVisible={preview !== undefined}
        prompt="Apply rules to pending reviews?"
        description="Each decision is recorded as automatic and posted on its pull request."
        action="Apply"
        submitDisabled={!preview?.pending.length || applyMutation.isPending}
        onCancelled={() => setPreview(undefined)}
        onConfirmed={() =>
          applyMutation.mutate(undefined, {
            onSuccess: (response) => {
              setPreview(undefined)
              setStatus(
                response.data.length === 1
                  ? "Decided 1 review."
                  : `Decided ${response.data.length} reviews.`,
              )
              return queryClient.invalidateQueries()
            },
          })
        }
      >
        {preview && <PreviewResult preview={preview} />}
      </ConfirmDialog>
    </div>
  )
}

export default function PermissionRuleList() {
  const t = useTranslations()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Rule | null>()
  const [error, setError] = useState<string>()
  const query = useListPermissionRulesModerationPermissionRulesGet({
    axios: { withCredentials: true },
  })
  const toggle = useUpdatePermissionRuleModerationPermissionRulesRuleIdPut({
    axios: { withCredentials: true },
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey:
            getListPermissionRulesModerationPermissionRulesGetQueryKey(),
        }),
      onError: (e) => setError(errorText(e)),
    },
  })
  const rules = query.data?.data

  return (
    <div
      className={cn(permissionReviewTheme, "flex min-w-0 flex-col gap-6 py-8")}
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Permission rules
          </h1>
          <p className="mb-0 text-sm text-muted-foreground">
            Approve or reject common permission changes without a moderator.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <ApplyRules />
          <Button onClick={() => setEditing(null)}>
            <Plus data-icon="inline-start" />
            New rule
          </Button>
        </div>
      </header>
      {error && <InlineError error={error} shown={true} />}
      <section
        className={cn(permissionReviewSurface, "overflow-hidden")}
        aria-label="Permission rules"
      >
        {query.isPending && (
          <div className="p-12" role="status" aria-label="Loading rules">
            <Spinner size="m" />
          </div>
        )}
        {query.isError && (
          <div className="p-5">
            <InlineError error={t(query.error.message)} shown={true} />
          </div>
        )}
        {rules?.length === 0 && (
          <p className="mb-0 px-5 py-16 text-center text-muted-foreground">
            No permission rules yet.
          </p>
        )}
        {rules && rules.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "Decision",
                  "Permission",
                  "Rationale",
                  "Enabled",
                  "Updated",
                ].map((column) => (
                  <TableHead
                    key={column}
                    scope="col"
                    className="bg-muted/40 px-5 py-3 text-xs font-medium"
                  >
                    {column}
                  </TableHead>
                ))}
                <TableHead className="bg-muted/40 px-5 py-3">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id} className="border-border/50">
                  <TableCell className="px-5 py-3 align-top">
                    <OutcomeBadge outcome={rule.decision} />
                  </TableCell>
                  <TableCell className="px-5 py-3 align-top whitespace-normal">
                    <div className="text-xs text-muted-foreground">
                      {rule.permission_group}
                    </div>
                    <div className="font-mono text-[13px] [overflow-wrap:anywhere]">
                      {ruleLabel(rule)}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-md px-5 py-3 align-top text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {rule.rationale}
                  </TableCell>
                  <TableCell className="px-5 py-3 align-top">
                    <Switch
                      checked={rule.enabled}
                      disabled={toggle.isPending}
                      aria-label={`Enable rule ${ruleLabel(rule)}`}
                      onCheckedChange={(enabled) => {
                        setError(undefined)
                        toggle.mutate({
                          ruleId: rule.id,
                          data: { ...ruleInput(rule), enabled },
                        })
                      }}
                    />
                  </TableCell>
                  <TableCell className="px-5 py-3 align-top text-xs text-muted-foreground">
                    <div>{rule.updated_by_name ?? "—"}</div>
                    <time dateTime={rule.updated_at}>
                      {rule.updated_at.replace("T", " · ").replace(/\.\d+/, "")}
                    </time>
                  </TableCell>
                  <TableCell className="px-5 py-3 text-end align-top">
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`Edit rule ${ruleLabel(rule)}`}
                      onClick={() => setEditing(rule)}
                    >
                      <Pencil data-icon="inline-start" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
      {editing !== undefined && (
        <RuleEditor
          key={editing?.id ?? "new"}
          rule={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  )
}
