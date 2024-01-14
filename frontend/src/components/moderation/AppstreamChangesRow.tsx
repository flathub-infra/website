import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import ReviewRow from "./ReviewRow"
import { ModerationRequestResponse } from "src/codegen"

interface Props {
  request: ModerationRequestResponse
}

const ArrayWithNewlines = ({ array }: { array: string[] }) => {
  return (
    <>
      {array.map((v) => {
        return (
          <>
            {v}
            <br />
          </>
        )
      })}
    </>
  )
}

const DiffRow = ({
  valueKey: valueKey,
  request,
}: {
  valueKey: string
  request: ModerationRequestResponse
}) => {
  // can be string or string[]
  const currenValues = request.request_data.current_values[valueKey] as
    | string
    | [key: string, value: string[] | [key: string, value: string[]]]
  const newValues = request.request_data.keys[valueKey] as
    | string
    | [key: string, value: string[] | [key: string, value: string[]]]

  // handle simple strings
  if (
    typeof currenValues === "string" &&
    typeof newValues === "string" &&
    currenValues !== newValues
  ) {
    return (
      <tr>
        <td className="align-top">{valueKey}</td>
        {!request.is_new_submission && (
          <td className="align-top">{currenValues}</td>
        )}
        <td className="align-top">{newValues}</td>
      </tr>
    )
  }

  // handle mapped strings
  if (
    typeof currenValues === "object" &&
    typeof newValues === "object" &&
    currenValues !== null &&
    newValues !== null
  ) {
    return (
      <>
        {Object.keys(currenValues).map((key) => {
          // handle arrays
          if (Array.isArray(currenValues[key])) {
            if (
              JSON.stringify(currenValues[key]) ===
              JSON.stringify(newValues[key])
            ) {
              return null
            }

            return (
              <tr key={key}>
                <td className="align-top">
                  {valueKey} {key}
                </td>
                {!request.is_new_submission && (
                  <td className="align-top">
                    <ArrayWithNewlines array={currenValues[key].toSorted()} />
                  </td>
                )}
                <td className="align-top">
                  <ArrayWithNewlines array={newValues[key].toSorted()} />
                </td>
              </tr>
            )
          }

          //handle sub mapped strings
          if (typeof currenValues[key] === "object") {
            if (
              JSON.stringify(currenValues[key]) ===
              JSON.stringify(newValues[key])
            ) {
              return null
            }

            return (
              <>
                {Object.keys(currenValues[key]).map((subKey) => {
                  return (
                    <tr key={subKey}>
                      <td className="align-top">
                        {valueKey} {subKey}
                      </td>
                      {!request.is_new_submission && (
                        <td className="align-top">
                          <ArrayWithNewlines
                            array={currenValues[key][subKey]}
                          />
                        </td>
                      )}
                      <td className="align-top">
                        <ArrayWithNewlines array={newValues[key][subKey]} />
                      </td>
                    </tr>
                  )
                })}
              </>
            )
          }
        })}
      </>
    )
  }
}

const AppstreamChangesRow: FunctionComponent<Props> = ({ request }) => {
  const { t } = useTranslation()

  const keys = request.request_data
    ? Object.keys(request.request_data?.keys)
    : []

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
