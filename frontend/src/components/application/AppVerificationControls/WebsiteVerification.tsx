import { Trans, useTranslation } from "next-i18next"
import { FunctionComponent, ReactElement, useCallback, useState } from "react"
import {
  confirmWebsiteVerification,
  setupWebsiteVerification,
  WebsiteVerificationConfirmResult,
} from "src/asyncs/app"
import Button from "src/components/Button"
import InlineError from "src/components/InlineError"
import Spinner from "src/components/Spinner"
import { useAsync } from "src/hooks/useAsync"
import { VerificationMethodWebsite } from "src/types/VerificationAvailableMethods"
import { FlathubDisclosure } from "../../Disclosure"

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
        <InlineError
          shown={true}
          error={t("server-returned-status-code", {
            code: confirmResult.status_code,
          })}
        ></InlineError>
      )
    } else if (confirmResult.detail == "failed_to_connect") {
      resultInfo = (
        <InlineError
          shown={true}
          error={t("verification-failed-to-connect", {
            domain: method.website,
          })}
        ></InlineError>
      )
    } else if (confirmResult.detail == "app_not_listed") {
      resultInfo = (
        <InlineError
          shown={true}
          error={t("failed-to-find-token", {
            domain: method.website,
          })}
        ></InlineError>
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
      <div className="space-y-2">
        <div>
          <Trans i18nKey={"website-validation-instruction"}>
            Create a page at <a href={webpage}>{{ webpage }}</a> containing the
            following token:
            <div className="p-3 font-semibold text-textSecondary">
              {{ token }}
            </div>
            If the page already exists, add the token to it.
          </Trans>
        </div>

        <Button onClick={verifyApp}>{t("continue")}</Button>

        {verifyAppStatus === "pending" && (
          <div className="flex flex-col items-start">
            <Spinner size="s" text={t("verifying")} />
          </div>
        )}

        {resultInfo}
      </div>
    )
  } else {
    content = (
      <>
        <p>
          <Trans i18nKey={"website-verification-main-instruction"}>
            Verify your right to use the app ID
            <span className="font-semibold">{{ id: appId }}</span> by placing a
            token at a specific page on
            <span className="font-semibold">{{ domain: method.website }}</span>.
          </Trans>
        </p>
        <Button onClick={setup} disabled={setupStatus === "pending"}>
          {t("begin")}
        </Button>
      </>
    )
  }

  return (
    <FlathubDisclosure
      key={method.method}
      buttonItems={
        <h4 className="text-xl font-medium">{t("website-verification")}</h4>
      }
    >
      {content}
    </FlathubDisclosure>
  )
}

export default WebsiteVerification
