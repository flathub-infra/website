import { Trans, useTranslation } from "next-i18next"
import {
  FunctionComponent,
  ReactElement,
  useCallback,
  useEffect,
  useState,
} from "react"
import { unverifyApp } from "src/asyncs/app"
import { Notice } from "src/components/Notice"
import {
  fetchVerificationAvailableMethods,
  fetchVerificationStatus,
} from "src/fetchers"
import { Appstream } from "src/types/Appstream"
import { VerificationAvailableMethods } from "src/types/VerificationAvailableMethods"
import { VerificationStatus } from "src/types/VerificationStatus"
import { verificationProviderToHumanReadable } from "src/verificationProvider"
import Button from "../../Button"
import ConfirmDialog from "../../ConfirmDialog"
import Spinner from "../../Spinner"
import LoginVerification from "./LoginVerification"
import WebsiteVerification from "./WebsiteVerification"

interface Props {
  app: Appstream
}

const StatusInfo: FunctionComponent<{ status: VerificationStatus }> = ({
  status,
}) => {
  const { t } = useTranslation()

  switch (status.method) {
    case "none" || !status.verified:
      return t("app-is-currently-not-verified")
    case "login_provider":
      return (
        <Trans i18nKey="app-is-currently-verified-by-login-provider">
          Your app is currently verified by your login
          <span className="font-medium">
            @{{ login_name: status.login_name }}
          </span>
          on
          <span className="font-medium">
            {{
              login_provider: verificationProviderToHumanReadable(
                status.login_provider,
              ),
            }}
          </span>
          .
        </Trans>
      )
    case "website":
      return (
        <Trans i18nKey="app-is-currently-verified-by-website">
          Your app is currently verified by your website
          <span className="font-medium">{{ website: status.website }}</span>
        </Trans>
      )
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

  const [confirmUnverify, setConfirmUnverify] = useState<boolean>(false)

  const doFetch = useCallback(async () => {
    try {
      const fetchStatus = await fetchVerificationStatus(app.id)
      setVerificationStatus(fetchStatus)

      if (!fetchStatus?.verified) {
        const fetch = await fetchVerificationAvailableMethods(app.id)
        setVerificationMethods(fetch)
      } else {
        setVerificationMethods(null)
      }

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
  if (error || verificationMethods?.detail) {
    content = (
      <>
        <p>{t("error")}</p>
        {error && <p>{error}</p>}
        {verificationMethods?.detail && (
          <span className="text-xs text-flathub-sonic-silver dark:text-flathub-spanish-gray">
            {t("error-code", { code: verificationMethods.detail })}
          </span>
        )}
      </>
    )
  } else if (verificationStatus?.verified) {
    content = (
      <div className="space-y-3">
        <StatusInfo status={verificationStatus} />

        <br />

        <Button onClick={() => setConfirmUnverify(true)}>
          {t("unverify")}
        </Button>

        <ConfirmDialog
          isVisible={confirmUnverify}
          prompt={t("unverify-app-prompt", { appId: app.id })}
          action={t("unverify")}
          actionVariant="destructive"
          onConfirmed={() => {
            setConfirmUnverify(false)
            unverifyApp(app.id).then(doFetch)
          }}
          onCancelled={() => setConfirmUnverify(false)}
        />
      </div>
    )
  } else {
    content = (
      <div className="space-y-3">
        <p className="xl:max-w-[75%]">{t("verification-instructions")}</p>
        <div className="xl:max-w-[75%]">
          <Notice>{t("verification-warning")}</Notice>
        </div>

        {verificationMethods?.methods.map((methodType) => {
          if (methodType.method === "website") {
            return (
              <WebsiteVerification
                key={methodType.method}
                appId={app.id}
                method={methodType}
                onVerified={doFetch}
              ></WebsiteVerification>
            )
          }
          if (methodType.method === "login_provider") {
            return (
              <LoginVerification
                key={methodType.method}
                appId={app.id}
                method={methodType}
                onVerified={doFetch}
                onReloadNeeded={doFetch}
              ></LoginVerification>
            )
          }
        })}
      </div>
    )
  }

  return (
    <>
      <h2>{t("setup-verification")}</h2>
      {content}
    </>
  )
}

export default AppVerificationSetup
