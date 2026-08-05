import { Link, Section, Text } from "react-email"
import { Base, buildAppName } from "./base"
import { BuildLog } from "./buildlog"

function alignArrays(a?: string[], b?: string[]): { a: string[]; b: string[] } {
  const orig = [a ?? [], b ?? []]

  const template = Array.from(
    new Set(orig.reduce((a, b) => a.concat(b))),
  ).sort()

  const result = orig.map((row) =>
    row.slice(0).reduce((output, val) => {
      const idx = template.indexOf(val)
      output[idx] = val
      return output
    }, Array(template.length).fill(null)),
  )

  return { a: result[0], b: result[1] }
}

export interface ModerationEmailProps {
  appId: string
  appName: string | null
  category: "moderation_approved" | "moderation_held" | "moderation_rejected"
  subject: string
  previewText: string
  buildId: number
  buildLogUrl: string | null
  requests: Request[]
}

export interface AppdataRequest {
  requestType: "appdata"
  requestData: {
    keys: {
      [key: string]:
        | string
        | string[]
        | boolean
        | { [key: string]: string[] | { [key: string]: string[] } }
        | null
    }
    current_values: {
      [key: string]:
        | string
        | string[]
        | boolean
        | { [key: string]: string[] | { [key: string]: string[] } }
        | null
    }
  }
  isNewSubmission: boolean
}

export interface ManifestRequest {
  requestType: "manifest"
  requestData: {
    findings: {
      origins_added: string[]
      origins_removed: string[]
      locations_by_origin: Record<string, string[]>
      candidate_issues: {
        location: string
        reason: string
      }[]
      arches: string[]
    }[]
  }
  isNewSubmission: false
}

export type Request = AppdataRequest | ManifestRequest

export const RANDOM_REVIEW_MARKER = "Randomly selected for human review"

export function isRandomReviewRequest(
  request: Request,
): request is AppdataRequest {
  return (
    request.requestType === "appdata" &&
    request.requestData.keys.human_review === RANDOM_REVIEW_MARKER &&
    Object.keys(request.requestData.keys).length === 1 &&
    Object.keys(request.requestData.current_values).length === 0
  )
}

const ArrayWithNewlines = ({ array }: { array: string[] }) => {
  return array.map((v, i) => (
    <span key={i} className="break-all">
      {v}
      <br />
    </span>
  ))
}

const TableRow = ({
  valueKey,
  isNewSubmission,
  currentValueList,
  newValueList,
}: {
  valueKey: string
  isNewSubmission: boolean
  currentValueList: string[]
  newValueList: string[]
}) => {
  return (
    <tr key={valueKey}>
      <td className="align-top break-all">{valueKey}</td>
      {!isNewSubmission && (
        <td className="align-top break-all">
          <ArrayWithNewlines array={currentValueList} />
        </td>
      )}
      <td className="align-top break-all">
        <ArrayWithNewlines array={newValueList} />
      </td>
    </tr>
  )
}

const DiffRow = ({
  valueKey,
  request,
}: {
  valueKey: string
  request: AppdataRequest
}) => {
  const current_values = request.requestData.current_values[valueKey] as
    | string
    | string[]
    | { [key: string]: string[] }
  const newValues = request.requestData.keys[valueKey] as
    | string
    | string[]
    | { [key: string]: string[] }

  if (Array.isArray(current_values) || Array.isArray(newValues)) {
    if (JSON.stringify(current_values) === JSON.stringify(newValues)) {
      return null
    }
    const { a: currentValueList, b: newValueList } = alignArrays(
      current_values as string[],
      newValues as string[],
    )

    return (
      <TableRow
        key={valueKey}
        valueKey={valueKey}
        isNewSubmission={request.isNewSubmission}
        currentValueList={currentValueList}
        newValueList={newValueList}
      />
    )
  }

  if (
    typeof current_values === "string" ||
    typeof newValues === "string" ||
    typeof current_values === "boolean" ||
    typeof newValues === "boolean"
  ) {
    return (
      <tr>
        <td className="align-top break-all">{valueKey}</td>
        {!request.isNewSubmission && (
          <td className="align-top break-all">{current_values?.toString()}</td>
        )}
        <td className="align-top break-all">{newValues?.toString()}</td>
      </tr>
    )
  }

  if (typeof current_values === "object" || typeof newValues === "object") {
    const uniqueKeys = Array.from(
      new Set([
        ...Object.keys(current_values ?? []),
        ...Object.keys(newValues ?? []),
      ]),
    ).sort()

    return (
      <>
        {uniqueKeys.map((key) => {
          // handle arrays
          if (
            (current_values?.[key] && Array.isArray(current_values[key])) ||
            (newValues?.[key] && Array.isArray(newValues[key]))
          ) {
            if (
              JSON.stringify(current_values?.[key]) ===
              JSON.stringify(newValues?.[key])
            ) {
              return null
            }

            const { a: currentValueList, b: newValueList } = alignArrays(
              current_values?.[key],
              newValues?.[key],
            )

            return (
              <TableRow
                key={valueKey}
                valueKey={valueKey}
                isNewSubmission={request.isNewSubmission}
                currentValueList={currentValueList}
                newValueList={newValueList}
              />
            )
          }
        })}
      </>
    )
  }
}

export const ModerationRequestItem = ({ request }: { request: Request }) => {
  if (request.requestType === "manifest") {
    return (
      <Section className="mt-8">
        {request.requestData.findings.map((finding, findingIndex) => (
          <Section
            className="mb-4 rounded border border-solid border-gray-300 p-4"
            key={`${finding.arches.join(",")}-${findingIndex}`}
          >
            <Text className="mb-1 font-bold">New origins</Text>
            {Array.from(new Set(finding.origins_added)).map((origin) => (
              <div key={origin}>
                <code>{origin}</code>
                <Text className="mb-1 mt-2">Source locations</Text>
                <ul>
                  {Array.from(
                    new Set(finding.locations_by_origin[origin] ?? []),
                  ).map((location) => (
                    <li key={location}>
                      <code>{location}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {finding.origins_removed.length > 0 && (
              <>
                <Text className="mb-1 font-bold">
                  Previous origins no longer used
                </Text>
                <ul>
                  {Array.from(new Set(finding.origins_removed)).map(
                    (origin) => (
                      <li key={origin}>
                        <code>{origin}</code>
                      </li>
                    ),
                  )}
                </ul>
              </>
            )}
            {finding.candidate_issues.length > 0 && (
              <>
                <Text className="mb-1 font-bold">Source URL issues</Text>
                <ul>
                  {Array.from(
                    new Map(
                      finding.candidate_issues.map((issue) => [
                        `${issue.location}\u0000${issue.reason}`,
                        issue,
                      ]),
                    ).values(),
                  ).map((issue) => (
                    <li key={`${issue.location}\u0000${issue.reason}`}>
                      <code>{issue.location}</code>: <code>{issue.reason}</code>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <Text className="mb-1 font-bold">Affected architectures</Text>
            <Text>
              {Array.from(new Set(finding.arches)).map((arch, index) => (
                <span key={arch}>
                  {index > 0 && ", "}
                  <code>{arch}</code>
                </span>
              ))}
            </Text>
          </Section>
        ))}
      </Section>
    )
  }

  const currentValuesFiltered = Object.keys(
    request.requestData.current_values,
  ).filter(
    (a) =>
      a !== "name" &&
      a !== "developer_name" &&
      a !== "project_license" &&
      a !== "summary",
  )

  const uniqueKeys = Array.from(
    new Set([
      ...Object.keys(request.requestData.keys),
      ...currentValuesFiltered,
    ]),
  ).sort()

  return (
    <Section className="mt-8">
      <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "20%" }} />
          {!request.isNewSubmission && <col style={{ width: "40%" }} />}
          <col style={{ width: request.isNewSubmission ? "80%" : "40%" }} />
        </colgroup>
        <tr className="text-left rtl:text-right">
          <th>Field</th>
          {!request.isNewSubmission && <th>Old value</th>}
          <th>New value</th>
        </tr>
        {uniqueKeys.map((key) => (
          <DiffRow key={key} valueKey={key} request={request} />
        ))}
      </table>
    </Section>
  )
}

export const ModerationHeldEmail = ({
  category,
  appId,
  appName,
  subject,
  previewText,
  buildId,
  buildLogUrl,
  requests,
}: ModerationEmailProps) => {
  const appNameAndId = buildAppName(appId, appName)

  const isRandomReview =
    requests.length > 0 && requests.every(isRandomReviewRequest)
  const hasManifestRequest = requests.some(
    (request) => request.requestType === "manifest",
  )
  return (
    <Base
      previewText={previewText}
      subject={subject}
      category={category}
      appId={appId}
      appName={appName}
    >
      {isRandomReview ? (
        <Text>
          Build <BuildLog buildId={buildId} buildLogUrl={buildLogUrl} /> of{" "}
          <b>{appNameAndId}</b> has been selected for human review. Check the
          status of the review in the{" "}
          <Link href={`https://flathub.org/apps/manage/${appId}`}>
            app developer settings
          </Link>
          .
        </Text>
      ) : (
        <Text>
          Build <BuildLog buildId={buildId} buildLogUrl={buildLogUrl} /> of{" "}
          <b>{appNameAndId}</b>{" "}
          {hasManifestRequest
            ? "has been held for review because its embedded manifest introduces a new source origin."
            : "has been held for review because the app's metadata has changed."}{" "}
          Check the status of the review in the{" "}
          <Link href={`https://flathub.org/apps/manage/${appId}`}>
            app developer settings
          </Link>
          .
        </Text>
      )}
      <Text>
        {isRandomReview
          ? "You'll receive another email when the review is approved or rejected."
          : "You'll receive another email when the changes are approved or rejected."}
      </Text>
      {isRandomReview ? (
        <Text>Reason: {RANDOM_REVIEW_MARKER}.</Text>
      ) : (
        requests.map((request, i) => (
          <ModerationRequestItem key={i} request={request} />
        ))
      )}
    </Base>
  )
}

ModerationHeldEmail.PreviewProps = {
  appId: "org.test.Test",
  appName: "Test",
  subject: "App was held for moderation",
  previewText: "Your app was held",
  category: "moderation_held",
  buildId: 123,
  buildLogUrl: "https://flathub.org/",
  requests: [
    {
      requestType: "appdata",
      requestData: {
        keys: {
          name: "My Awesome Test App",
        },
        current_values: {
          name: "Test App",
        },
      },
      isNewSubmission: false,
    },
  ],
} as ModerationEmailProps

export default ModerationHeldEmail
