import { Trans, useTranslation } from "next-i18next"
import { FunctionComponent, ReactElement, useState } from "react"
import InlineError from "src/components/InlineError"
import Spinner from "src/components/Spinner"
import { FlathubDisclosure } from "../../Disclosure"
import { useMutation } from "@tanstack/react-query"
import { AvailableMethod, WebsiteVerificationResult } from "src/codegen/model"
import {
  confirmWebsiteVerificationVerificationAppIdConfirmWebsiteVerificationPost,
  setupWebsiteVerificationVerificationAppIdSetupWebsiteVerificationPost,
} from "src/codegen"
import { Button } from "@/components/ui/button"

interface Props {
  appId: string
  method: AvailableMethod
  isNewApp: boolean
  onVerified: () => void
}

const WebsiteVerification: FunctionComponent<Props> = ({
  appId,
  method,
  isNewApp,
  onVerified,
}) => {
  const { t } = useTranslation()

  const [returnedToken, setReturnedToken] = useState<string>(null)
  const [confirmResult, setConfirmResult] =
    useState<WebsiteVerificationResult>(null)

  const setupWebsiteVerificationMutation = useMutation({
    mutationKey: ["website-verification", appId, isNewApp ?? false],
    mutationFn: () =>
      setupWebsiteVerificationVerificationAppIdSetupWebsiteVerificationPost(
        appId,
        { new_app: isNewApp },
        {
          withCredentials: true,
        },
      ),
    onSuccess: (result) => setReturnedToken(result.data.token),
  })

  const confirmWebsiteVerificationMutation = useMutation({
    mutationKey: ["confirm-website-verification", appId, isNewApp ?? false],
    mutationFn: () =>
      confirmWebsiteVerificationVerificationAppIdConfirmWebsiteVerificationPost(
        appId,
        { new_app: isNewApp },
        {
          withCredentials: true,
        },
      ),
    onSuccess: (result) => {
      if (result.data.verified) {
        onVerified()
      } else {
        setConfirmResult(result.data)
      }
    },
  })

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
            <span className="text-xs text-flathub-sonic-silver dark:text-flathub-spanish-gray">
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
            Create a page at{" "}
            <a className="no-underline hover:underline" href={webpage}>
              {{ webpage }}
            </a>{" "}
            containing the following token:
            <div className="p-3 font-semibold text-flathub-sonic-silver dark:text-flathub-spanish-gray">
              {{ token }}
            </div>
            If the page already exists, add the token to it.
          </Trans>
        </div>

        <Button
          size="lg"
          onClick={() => confirmWebsiteVerificationMutation.mutate()}
        >
          {t("continue")}
        </Button>

        {confirmWebsiteVerificationMutation.isPending && (
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
        <Button
          size="lg"
          onClick={() => setupWebsiteVerificationMutation.mutate()}
          disabled={setupWebsiteVerificationMutation.isPending}
        >
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
