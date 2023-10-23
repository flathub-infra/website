import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import ReviewRow from "./ReviewRow"
import { ModerationRequestResponse } from "src/codegen"

interface Props {
  request: ModerationRequestResponse
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
            <tr key={key}>
              <td>{key}</td>
              {!request.is_new_submission && (
                <td>{request.request_data.current_values[key]}</td>
              )}
              <td>{request.request_data.keys[key]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ReviewRow>
  )
}

export default AppstreamChangesRow
