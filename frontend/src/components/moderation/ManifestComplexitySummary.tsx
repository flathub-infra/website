import { FunctionComponent } from "react"
import { useTranslations } from "next-intl"
import { ManifestComplexityRequestData } from "src/codegen"

interface Props {
  complexity: ManifestComplexityRequestData
}

const eventLabels: Record<string, string> = {
  module_added: "Module added",
  module_removed: "Module removed",
  module_match_ambiguous: "Module matching was ambiguous",
  source_type_changed: "Source type changed",
  source_options_changed: "Source options changed",
  source_order_changed: "Source order changed",
  patch_or_script_added: "Patch or script added",
  source_set_changed: "Source set changed",
  buildsystem_changed: "Build system changed",
  build_commands_changed: "Build commands changed",
  post_install_changed: "Post-install commands changed",
  config_options_changed: "Configure options changed",
  build_options_changed: "Build options changed",
  module_layout_changed: "Module layout changed",
  top_level_cleanup_changed: "Top-level cleanup changed",
  extensions_changed: "Extensions changed",
  runtime_id_changed: "Runtime changed",
  sdk_id_changed: "SDK changed",
  application_command_changed: "Application command changed",
  arch_selection_changed: "Architecture selection changed",
}

const summaryText = (value: unknown, includeNull = false): string | null => {
  if (value === null) {
    return includeNull ? "null" : null
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value)
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return null
  }
  const summary = value as Record<string, unknown>
  if (Array.isArray(summary.changed_keys)) {
    const values =
      typeof summary.values === "object" &&
      summary.values !== null &&
      !Array.isArray(summary.values)
        ? (summary.values as Record<string, unknown>)
        : {}
    return summary.changed_keys
      .filter((item): item is string => typeof item === "string")
      .map((key) => {
        if (!Object.prototype.hasOwnProperty.call(values, key)) {
          return null
        }
        const detail = summaryText(values[key], true)
        return detail !== null ? `${key}: ${detail}` : key
      })
      .filter((item): item is string => item !== null)
      .join(", ")
  }
  if (typeof summary.count === "number") {
    const values = Array.isArray(summary.values)
      ? summary.values
          .map((item) => summaryText(item, true))
          .filter((item): item is string => item !== null)
          .join(", ")
      : ""
    const label = summary.count === 1 ? "item" : "items"
    return values
      ? `${summary.count} ${label} (${values})`
      : `${summary.count} ${label}`
  }
  if (typeof summary.key_count === "number") {
    const keys = Array.isArray(summary.keys)
      ? summary.keys
          .filter((item): item is string => typeof item === "string")
          .join(", ")
      : ""
    const label = summary.key_count === 1 ? "key" : "keys"
    return keys
      ? `${summary.key_count} ${label} (${keys})`
      : `${summary.key_count} ${label}`
  }
  if (typeof summary.added_commands === "number") {
    return `${summary.added_commands} added, ${summary.removed_commands ?? 0} removed, ${summary.replaced_commands ?? 0} replaced`
  }
  return null
}
const sourceSetSummaryText = (value: unknown): string | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }
  const summary = value as Record<string, unknown>
  const counts = ["added", "removed", "changed"].map((key) => summary[key])
  if (
    !counts.every(
      (count) =>
        typeof count === "number" && Number.isInteger(count) && count >= 0,
    )
  ) {
    return null
  }
  const [added, removed, changed] = counts as [number, number, number]
  return `${added} added, ${removed} removed, ${changed} changed`
}

const ManifestComplexitySummary: FunctionComponent<Props> = ({
  complexity,
}) => {
  const t = useTranslations()
  const hasAmbiguity = complexity.events.some(
    (event) => event.kind === "module_match_ambiguous",
  )

  return (
    <div className="space-y-5">
      {hasAmbiguity && (
        <div className="rounded-lg border border-flathub-status-yellow bg-flathub-status-yellow/10 px-4 py-3 text-sm text-flathub-status-yellow-dark dark:text-flathub-status-yellow">
          {t("moderation-manifest-complexity-ambiguity")}
        </div>
      )}

      <div>
        <h3 className="mb-2 font-semibold">
          {t("moderation-manifest-complexity-events")}
        </h3>
        <div className="divide-y divide-flathub-gainsborow rounded-lg border border-flathub-gainsborow dark:divide-flathub-dark-gunmetal dark:border-flathub-dark-gunmetal">
          {complexity.events.map((event, index) => {
            const eventKind = String(event.kind)
            const isSourceSetChanged = eventKind === "source_set_changed"
            const aggregateText = isSourceSetChanged
              ? sourceSetSummaryText(event.new_summary)
              : null
            const oldText = isSourceSetChanged
              ? null
              : summaryText(event.old_summary)
            const newText = isSourceSetChanged
              ? null
              : summaryText(event.new_summary)
            return (
              <div
                className="space-y-1 px-4 py-3"
                key={`${eventKind}-${event.location}-${index}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {eventLabels[eventKind] ?? eventKind}
                  </span>
                  <code className="text-xs break-all">{event.location}</code>
                </div>
                {isSourceSetChanged
                  ? aggregateText && (
                      <div className="text-xs text-flathub-sonic-silver dark:text-flathub-spanish-gray">
                        <span>{aggregateText}</span>
                      </div>
                    )
                  : (oldText || newText) && (
                      <div className="text-xs text-flathub-sonic-silver dark:text-flathub-spanish-gray">
                        {oldText && <span>− {oldText}</span>}
                        {oldText && newText && <span> · </span>}
                        {newText && <span>+ {newText}</span>}
                      </div>
                    )}
              </div>
            )
          })}
        </div>
        {complexity.events_truncated && (
          <p className="mt-2 text-xs text-flathub-sonic-silver dark:text-flathub-spanish-gray">
            {t("moderation-manifest-complexity-events-truncated", {
              shown: complexity.events.length,
              total: complexity.total_event_count,
            })}
          </p>
        )}
      </div>
    </div>
  )
}

export default ManifestComplexitySummary
