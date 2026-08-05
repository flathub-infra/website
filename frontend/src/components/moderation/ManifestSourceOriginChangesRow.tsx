import { FunctionComponent } from "react"
import { useTranslations } from "next-intl"
import {
  ManifestSourceOriginRequestData,
  ModerationRequestResponse,
} from "src/codegen"
import ReviewCard from "./ReviewCard"

interface Props {
  request: ModerationRequestResponse
}

const unique = (values: string[]) => [...new Set(values)]

const ManifestSourceOriginChangesRow: FunctionComponent<Props> = ({
  request,
}) => {
  const t = useTranslations()
  const requestData = request.request_data
  if (!requestData || !("findings" in requestData)) {
    return null
  }

  const findings = (requestData as ManifestSourceOriginRequestData).findings

  return (
    <ReviewCard
      title={t("moderation-manifest-source-origin")}
      request={request}
    >
      <div className="space-y-4">
        {findings.map((finding, findingIndex) => (
          <div
            className="space-y-3 rounded-lg border border-flathub-gainsborow p-4 dark:border-flathub-dark-gunmetal"
            key={`${finding.arches.join(",")}-${findingIndex}`}
          >
            <div>
              <h4 className="font-semibold">
                {t("moderation-manifest-origins-added")}
              </h4>
              <ul className="space-y-2">
                {unique(finding.origins_added).map((origin) => (
                  <li key={origin}>
                    <code>{origin}</code>
                    <div className="mt-1 text-sm">
                      {t("moderation-manifest-source-locations")}
                    </div>
                    <ul className="list-disc ps-6 text-sm">
                      {unique(finding.locations_by_origin[origin] ?? []).map(
                        (location) => (
                          <li key={location}>
                            <code>{location}</code>
                          </li>
                        ),
                      )}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>

            {finding.origins_removed.length > 0 && (
              <div>
                <h4 className="font-semibold">
                  {t("moderation-manifest-origins-removed")}
                </h4>
                <ul className="list-disc ps-6">
                  {unique(finding.origins_removed).map((origin) => (
                    <li key={origin}>
                      <code>{origin}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {finding.candidate_issues.length > 0 && (
              <div>
                <h4 className="font-semibold">
                  {t("moderation-manifest-candidate-issues")}
                </h4>
                <ul className="list-disc ps-6">
                  {unique(
                    finding.candidate_issues.map(
                      (issue) => `${issue.location}\u0000${issue.reason}`,
                    ),
                  ).map((issue) => {
                    const [location, reason] = issue.split("\u0000")
                    return (
                      <li key={issue}>
                        <code>{location}</code>: <code>{reason}</code>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            <div>
              <h4 className="font-semibold">
                {t("moderation-manifest-affected-architectures")}
              </h4>
              <div>
                {unique(finding.arches).map((arch, index) => (
                  <span key={arch}>
                    {index > 0 && ", "}
                    <code>{arch}</code>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ReviewCard>
  )
}

export default ManifestSourceOriginChangesRow
