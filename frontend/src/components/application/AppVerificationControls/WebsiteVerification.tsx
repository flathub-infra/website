import { Trans, useTranslation } from "next-i18next"
import { FunctionComponent, ReactElement, useCallback, useState } from "react"
import {
  confirmWebsiteVerification,
  setupWebsiteVerification,
  WebsiteVerificationConfirmResult,
} from "src/asyncs/app"
import Button from "src/components/Button"
import Spinner from "src/components/Spinner"
import { useAsync } from "src/hooks/useAsync"
import { VerificationMethodWebsite } from "src/types/VerificationAvailableMethods"
import { FlathubDisclosure } from "./Disclosure"

interface Props {
  appId: string
  method: VerificationMethodWebsite
  onVerified: () => void
}

const WebsiteVerification: FunctionComponent<Props> = ({
  appId,
  method,
  onVerified,
}) => {
  const { t } = useTranslation()

  const [returnedToken, setReturnedToken] = useState<string>(null)
  const [confirmResult, setConfirmResult] =
    useState<WebsiteVerificationConfirmResult>(null)

  const { execute: setup, status: setupStatus } = useAsync(
    useCallback(async () => {
      const result = await setupWebsiteVerification(appId)
      setReturnedToken(result.token)
    }, [appId, setReturnedToken]),
    false,
  )

  const { execute: verifyApp, status: verifyAppStatus } = useAsync(
    useCallback(async () => {
      const result = await confirmWebsiteVerification(appId)
      if (result.verified) {
        onVerified()
      } else {
        setConfirmResult(result)
      }
    }, [appId, onVerified, setConfirmResult]),
    false,
  )

  const token = returnedToken ?? method.website_token
  const webpage = `https://${method.website}/.well-known/org.flathub.VerifiedApps.txt`

  let content: ReactElement

  if (token) {
    let resultInfo: ReactElement

    if (confirmResult == null) {
      resultInfo = null
    } else if (confirmResult.detail == "server_returned_error") {
      resultInfo = (
        <p>
          {t("server-returned-status-code", {
            code: confirmResult.status_code,
          })}
        </p>
      )
    } else if (confirmResult.detail == "failed_to_connect") {
      resultInfo = (
        <div>
          {t("verification-failed-to-connect", {
            domain: method.website,
          })}
        </div>
      )
    } else {
      resultInfo = (
        <>
          <p>{t("error")}</p>
          {confirmResult.detail && (
            <span className="text-xs text-textSecondary">
              {t("error-code", { code: confirmResult.detail })}
            </span>
          )}
        </>
      )
    }

    content = (
      <>
        <div>
          <Trans i18nKey={"website-validation-instruction"}>
            Create a page at <a href={webpage}>{{ webpage }}</a>
            containing the following token:
            <div className="p-3 font-medium">{{ token }}</div>
            If the page already exists, add the token to it.
          </Trans>
        </div>

        <Button onClick={verifyApp}>{t("continue")}</Button>

        {verifyAppStatus === "pending" && (
          <div className="flex flex-col items-start">
            <Spinner size="m" text={t("verifying")} />
          </div>
        )}

        {resultInfo}
      </>
    )
  } else {
    content = (
      <Button onClick={setup} disabled={setupStatus === "pending"}>
        {t("begin")}
      </Button>
    )
  }

  return (
    <FlathubDisclosure
      key={method.method}
      buttonText={t("website-verification")}
    >
      <p>
        <Trans i18nKey={"website-verification-main-instruction"}>
          Verify your right to use the app ID
          <span className="font-medium">{{ id: appId }}</span> by placing a
          token at a specific page on
          <span className="font-medium">{{ domain: method.website }}</span>.
        </Trans>
      </p>

      {content}
    </FlathubDisclosure>
  )
}

export default WebsiteVerification
