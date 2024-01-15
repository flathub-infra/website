import { useTranslation } from "next-i18next"
import { Fragment, FunctionComponent } from "react"
import ReviewRow from "./ReviewRow"
import { ModerationRequestResponse } from "src/codegen"

interface Props {
  request: ModerationRequestResponse
}
function alignArrays(a: string[], b: string[]): { a: string[]; b: string[] } {
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

const ArrayWithNewlines = ({ array }: { array: string[] }) => {
  return array.map((v) => (
    <Fragment key={v}>
      {v}
      <br />
    </Fragment>
  ))
}

const DiffRow = ({
  valueKey: valueKey,
  request,
}: {
  valueKey: string
  request: ModerationRequestResponse
}) => {
  // can be string or string[]
  const currentValues = request.request_data.current_values[valueKey] as
    | string
    | [key: string, value: string[] | [key: string, value: string[]]]
  const newValues = request.request_data.keys[valueKey] as
    | string
    | [key: string, value: string[] | [key: string, value: string[]]]

  // handle mapped strings
  if (typeof currentValues === "object" || typeof newValues === "object") {
    const uniqueKeys = Array.from(
      new Set([...Object.keys(currentValues), ...Object.keys(newValues)]),
    ).sort()

    return (
      <>
        {uniqueKeys.map((key) => {
          // handle arrays
          if (
            Array.isArray(currentValues[key]) ||
            Array.isArray(newValues[key])
          ) {
            if (
              JSON.stringify(currentValues[key]) ===
              JSON.stringify(newValues[key])
            ) {
              return null
            }

            const { a: currentValueList, b: newValueList } = alignArrays(
              currentValues[key],
              newValues[key],
            )

            return (
              <tr key={key}>
                <td className="align-top">
                  {valueKey} {key}
                </td>
                {!request.is_new_submission && (
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

          //handle sub mapped strings
          if (
            typeof currentValues[key] === "object" ||
            typeof newValues[key] === "object"
          ) {
            if (
              JSON.stringify(currentValues[key]) ===
              JSON.stringify(newValues[key])
            ) {
              return null
            }

            const uniqueSubKeys = Array.from(
              new Set([
                ...Object.keys(currentValues[key] ?? {}),
                ...Object.keys(newValues[key] ?? {}),
              ]),
            ).sort()

            return uniqueSubKeys.map((subKey) => {
              return (
                <tr key={subKey}>
                  <td className="align-top">
                    {valueKey} {subKey}
                  </td>
                  {!request.is_new_submission && (
                    <td className="align-top">
                      <ArrayWithNewlines
                        array={currentValues[key]?.[subKey] ?? []}
                      />
                    </td>
                  )}
                  <td className="align-top">
                    <ArrayWithNewlines array={newValues[key]?.[subKey] ?? []} />
                  </td>
                </tr>
              )
            })
          }
        })}
      </>
    )
  }

  return (
    <tr>
      <td className="align-top">{valueKey}</td>
      {!request.is_new_submission && (
        <td className="align-top">{currentValues?.toString()}</td>
      )}
      <td className="align-top">{newValues?.toString()}</td>
    </tr>
  )
}

const AppstreamChangesRow: FunctionComponent<Props> = ({ request }) => {
  const { t } = useTranslation()

  const keys = Object.keys(request.request_data?.keys).sort()

  return (
    <ReviewRow
      title={
        request.is_new_submission
          ? t("moderation-appstream")
          : t("moderation-appstream-changes")
      }
      request={request}
    >
      <table className="w-full table-fixed">
        <thead>
          <tr className="text-left">
            <th>{t("moderation-key")}</th>
            {!request.is_new_submission && <th>{t("moderation-old-value")}</th>}
            <th>
              {request.is_new_submission
                ? t("moderation-value")
                : t("moderation-new-value")}
            </th>
          </tr>
        </thead>

        <tbody>
          {keys.map((key) => (
            <DiffRow key={key} valueKey={key.toString()} request={request} />
          ))}
        </tbody>
      </table>
    </ReviewRow>
  )
}

export default AppstreamChangesRow
