import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import { ModerationAppdataRequest } from "src/types/Moderation"
import ReviewRow from "./ReviewRow"

interface Props {
  request: ModerationAppdataRequest
}

const AppstreamChangesRow: FunctionComponent<Props> = ({ request }) => {
  const { t } = useTranslation()

  const keys = Object.keys(request.request_data.keys)

  return (
    <ReviewRow
      title={
        request.is_new_submission
          ? t("moderation-new-submission-appstream")
          : t("moderation-appstream-changes")
      }
      request={request}
    >
      <table className="w-full table-fixed">
        <thead>
          <tr className="text-left">
            <th className="w-60">{t("moderation-key")}</th>
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
