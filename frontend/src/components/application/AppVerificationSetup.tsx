import { useTranslation } from "next-i18next"
import {
  FunctionComponent,
  ReactElement,
  useCallback,
  useEffect,
  useState,
} from "react"
import {
  fetchVerificationAvailableMethods,
  fetchVerificationStatus,
} from "src/fetchers"
import { Appstream } from "src/types/Appstream"
import { VerificationAvailableMethods } from "src/types/VerificationAvailableMethods"
import { VerificationStatus } from "src/types/VerificationStatus"
import Spinner from "../Spinner"
import AppVerificationDisclosure from "./AppVerificationDisclosure"

interface Props {
  app: Appstream
}

const StatusInfo: FunctionComponent<{ status: VerificationStatus }> = ({
  status,
}) => {
  const { t } = useTranslation()

  switch (status.method) {
    case "none":
      return t("app-is-currently-not-verified")
    case "login_provider":
      return t("app-is-currently-verified-by-login-provider", {
        login_name: status.login_name,
        login_provider: status.login_provider,
      })
    case "website":
      return t("app-is-currently-verified-by-website", {
        website: status.website,
      })
    case "manual":
      return t("app-is-currently-verified-manually")
  }
}

const AppVerificationSetup: FunctionComponent<Props> = ({ app }) => {
  const { t } = useTranslation()

  const [verificationMethods, setVerificationMethods] =
    useState<VerificationAvailableMethods>(null)
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>(null)
  const [status, setStatus] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle")
  const [error, setError] = useState(null)

  const doFetch = useCallback(async () => {
    try {
      const fetch = await fetchVerificationAvailableMethods(app.id)
      setVerificationMethods(fetch)
      const fetchStatus = await fetchVerificationStatus(app.id)
      setVerificationStatus(fetchStatus)
      setStatus("success")
    } catch (err) {
      setStatus("error")
      setError(err)
    }
  }, [app.id])

  useEffect(() => {
    doFetch()
  }, [app.id, doFetch])

  if (["pending", "idle"].includes(status)) {
    return <Spinner size="m" />
  }

  let content: ReactElement
  if (error || verificationMethods.detail) {
    content = (
      <>
        <p>{t("error")}</p>
        {error && <p>{error}</p>}
        {verificationMethods.detail && (
          <span className="text-xs text-textSecondary">
            {t("error-code", { code: verificationMethods.detail })}
          </span>
        )}
      </>
    )
  } else {
    content = (
      <div className="space-y-3">
        <div>
          <StatusInfo status={verificationStatus} />
        </div>

        <AppVerificationDisclosure
          appId={app.id}
          verificationMethods={verificationMethods}
        />
      </div>
    )
  }

  return (
    <>
      <h3>{t("setup-verification")}</h3>
      {content}
    </>
  )
}

export default AppVerificationSetup
