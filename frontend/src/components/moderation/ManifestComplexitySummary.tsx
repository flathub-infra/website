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

const summaryText = (value: unknown): string | null => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value)
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }
  const summary = value as Record<string, unknown>
  if (Array.isArray(summary.changed_keys)) {
    return summary.changed_keys
      .filter((item) => typeof item === "string")
      .join(", ")
  }
  if (typeof summary.count === "number") {
    return `${summary.count} items`
  }
  if (typeof summary.key_count === "number") {
    return `${summary.key_count} keys`
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
      <p className="text-sm text-flathub-sonic-silver dark:text-flathub-spanish-gray">
        {t("moderation-manifest-complexity-explanation")}
      </p>

      {hasAmbiguity && (
        <div className="rounded-lg border border-flathub-status-yellow bg-flathub-status-yellow/10 px-4 py-3 text-sm text-flathub-status-yellow-dark dark:text-flathub-status-yellow">
          {t("moderation-manifest-complexity-ambiguity")}
        </div>
      )}

      {complexity.affected_arches.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {complexity.affected_arches.map((arch) => (
            <span
              className="inline-flex items-center rounded-md bg-flathub-gainsborow/50 px-2 py-0.5 font-mono text-xs font-medium text-flathub-dark-gunmetal dark:bg-flathub-granite-gray/50 dark:text-flathub-gainsborow"
              key={arch}
            >
              {arch}
            </span>
          ))}
        </div>
      )}

      {complexity.touched_modules.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold">
            {t("moderation-manifest-complexity-modules")}
          </h3>
          <div className="flex flex-wrap gap-2">
            {complexity.touched_modules.map((module) => (
              <code
                className="rounded bg-flathub-gainsborow/50 px-2 py-1 text-xs break-all dark:bg-flathub-dark-gunmetal"
                key={module}
              >
                {module}
              </code>
            ))}
          </div>
          {complexity.touched_modules_truncated && (
            <p className="mt-2 text-xs text-flathub-sonic-silver dark:text-flathub-spanish-gray">
              {t("moderation-manifest-complexity-modules-truncated", {
                shown: complexity.touched_modules.length,
                total: complexity.total_touched_module_count,
              })}
            </p>
          )}
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
