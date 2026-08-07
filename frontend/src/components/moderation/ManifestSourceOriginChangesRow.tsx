import { FunctionComponent } from "react"
import { useTranslations } from "next-intl"
import {
  ManifestSourceOriginFindingData,
  ManifestSourceOriginRequestData,
  ModerationRequestResponse,
} from "src/codegen"
import ReviewCard from "./ReviewCard"
import ManifestComplexitySummary from "./ManifestComplexitySummary"

interface Props {
  request: ModerationRequestResponse
}

const unique = (values: string[]) => [...new Set(values)]
const sourceModule = (location: string) => {
  const modules = Array.from(
    location.matchAll(/modules\[("(?:\\.|[^"\\])*"|\d+)\]/g),
    ([, segment]) =>
      segment.startsWith('"') ? (JSON.parse(segment) as string) : segment,
  )
  return modules.length > 0 ? modules.join(" / ") : location
}
const changesByModule = (finding: ManifestSourceOriginFindingData) => {
  const changes = new Map<
    string,
    { added: Set<string>; removed: Set<string> }
  >()

  const addOrigins = (origins: string[], change: "added" | "removed") => {
    for (const origin of unique(origins)) {
      const modules = unique(
        (finding.locations_by_origin[origin] ?? []).map(sourceModule),
      )
      for (const moduleName of modules.length > 0 ? modules : ["—"]) {
        const moduleChanges = changes.get(moduleName) ?? {
          added: new Set<string>(),
          removed: new Set<string>(),
        }
        moduleChanges[change].add(origin)
        changes.set(moduleName, moduleChanges)
      }
    }
  }

  addOrigins(finding.origins_removed, "removed")
  addOrigins(finding.origins_added, "added")

  return Array.from(changes, ([moduleName, origins]) => ({
    module: moduleName,
    added: Array.from(origins.added).sort(),
    removed: Array.from(origins.removed).sort(),
  })).sort((left, right) => left.module.localeCompare(right.module))
}

const ManifestSourceOriginChangesRow: FunctionComponent<Props> = ({
  request,
}) => {
  const t = useTranslations()
  const requestData = request.request_data
  if (!requestData || !("findings" in requestData)) {
    return null
  }

  const manifestData = requestData as ManifestSourceOriginRequestData
  const findings = manifestData.findings
  const complexity = manifestData.complexity
  const hasFindings = findings.length > 0
  const hasComplexity = complexity != null
  if (!hasFindings && !hasComplexity) {
    return null
  }

  const title = hasFindings
    ? hasComplexity
      ? t("moderation-manifest-source-and-complexity")
      : t("moderation-manifest-source-origin")
    : t("moderation-manifest-complexity")
  return (
    <ReviewCard title={title} request={request}>
      <div className="space-y-6">
        {complexity && <ManifestComplexitySummary complexity={complexity} />}
        {hasFindings && (
          <div className="divide-y divide-flathub-gainsborow overflow-hidden rounded-lg border border-flathub-gainsborow bg-flathub-white dark:divide-flathub-dark-gunmetal dark:border-flathub-dark-gunmetal dark:bg-flathub-arsenic">
            {findings.flatMap((finding, findingIndex) =>
              changesByModule(finding).map((change) => (
                <div
                  className="space-y-3 px-4 py-4"
                  key={`${findingIndex}-${change.module}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <code className="font-semibold">{change.module}</code>
                    <div className="flex flex-wrap gap-1">
                      {unique(finding.arches).map((arch) => (
                        <span
                          className="inline-flex items-center rounded-md bg-flathub-gainsborow/50 px-2 py-0.5 font-mono text-xs font-medium text-flathub-dark-gunmetal dark:bg-flathub-granite-gray/50 dark:text-flathub-gainsborow"
                          key={arch}
                        >
                          {arch}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    {change.removed.map((origin) => (
                      <div
                        className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-baseline text-flathub-sonic-silver dark:text-flathub-spanish-gray"
                        key={`removed-${origin}`}
                      >
                        <span aria-hidden="true" className="font-mono">
                          −
                        </span>
                        <span>
                          <span className="sr-only">
                            {t("moderation-manifest-removed")}:{" "}
                          </span>
                          <code className="break-all">{origin}</code>
                        </span>
                      </div>
                    ))}
                    {change.added.map((origin) => (
                      <div
                        className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-baseline font-medium text-flathub-status-yellow dark:text-flathub-status-yellow-dark"
                        key={`added-${origin}`}
                      >
                        <span aria-hidden="true" className="font-mono">
                          +
                        </span>
                        <span>
                          <span className="sr-only">
                            {t("moderation-manifest-added")}:{" "}
                          </span>
                          <code className="break-all">{origin}</code>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )),
            )}
          </div>
        )}
      </div>
    </ReviewCard>
  )
}

export default ManifestSourceOriginChangesRow
