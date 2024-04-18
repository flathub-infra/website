import { Heading, Section, Text } from "@react-email/components"
import { Base, buildAppName } from "./base"

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
  appName?: string
  category: "moderation_approved" | "moderation_held" | "moderation_rejected"
  subject: string
  previewText: string
  buildId: number
  buildLogUrl: string
  requests: Request[]
}

export interface Request {
  requestType: "appdata"
  requestData: {
    keys: {
      [key: string]:
        | string
        | string[]
        | boolean
        | { [key: string]: string[] | { [key: string]: string[] } }
    }
    current_values: {
      [key: string]:
        | string
        | string[]
        | boolean
        | { [key: string]: string[] | { [key: string]: string[] } }
    }
  }
  isNewSubmission: boolean
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
      <td className="align-top">{valueKey}</td>
      {!isNewSubmission && (
        <td className="align-top">
          <ArrayWithNewlines array={currentValueList} />
        </td>
      )}
      <td className="align-top">
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
  request: Request
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
        <td className="align-top">{valueKey}</td>
        {!request.isNewSubmission && (
          <td className="align-top">{current_values?.toString()}</td>
        )}
        <td className="align-top">{newValues?.toString()}</td>
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
  const currentValuesFiltered = Object.keys(
    request.requestData?.current_values ?? {},
  ).filter(
    (a) =>
      // these keys are special, but we don't want to act on them - so ignore
      a !== "name" &&
      a !== "developer_name" &&
      a !== "project_license" &&
      a !== "summary",
  )

  const uniqueKeys = Array.from(
    new Set([
      ...Object.keys(request.requestData?.keys ?? {}),
      ...currentValuesFiltered,
    ]),
  ).sort()

  return (
    <Section>
      <Heading as={"h3"}>{request.requestType}</Heading>
      {request.requestType === "appdata" && (
        <table className="w-full table-fixed text-xs">
          <tr className="text-left rtl:text-right">
            <th>Field</th>
            {!request.isNewSubmission && <th>Old value</th>}
            <th>New value</th>
          </tr>
          {uniqueKeys.map((key) => (
            <DiffRow key={key} valueKey={key} request={request} />
          ))}
        </table>
      )}
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

  return (
    <Base
      previewText={previewText}
      subject={subject}
      category={category}
      appId={appId}
      appName={appName}
    >
      <Text>
        Build <a href={buildLogUrl}>#{buildId}</a> of {appNameAndId} has been
        held for review because the app's metadata has changed. You can check
        the status of the review in the{" "}
        <a href={`https://flathub.org/apps/manage/${appId}`}>
          app developer settings
        </a>
        . You'll receive another email when the changes are approved or
        rejected.
      </Text>
      <Heading as={"h2"}>Changes:</Heading>
      {requests.map((request, i) => (
        <ModerationRequestItem key={i} request={request} />
      ))}
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
