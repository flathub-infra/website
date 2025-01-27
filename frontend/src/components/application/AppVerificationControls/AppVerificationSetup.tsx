import { Trans, useTranslation } from "next-i18next"
import { FunctionComponent, ReactElement, useCallback, useState } from "react"
import { Appstream } from "src/types/Appstream"
import { verificationProviderToHumanReadable } from "src/verificationProvider"
import ConfirmDialog from "../../ConfirmDialog"
import Spinner from "../../Spinner"
import LoginVerification from "./LoginVerification"
import WebsiteVerification from "./WebsiteVerification"
import InlineError from "src/components/InlineError"
import { useQuery } from "@tanstack/react-query"
import { VerificationMethod, VerificationStatus } from "src/codegen/model"
import {
  getVerificationStatusVerificationAppIdStatusGet,
  unverifyVerificationAppIdUnverifyPost,
  useGetAvailableMethodsVerificationAppIdAvailableMethodsGet,
} from "src/codegen"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Props {
  app: Appstream
  isNewApp: boolean
  onVerified?: () => void
  showHeader?: boolean
}

const StatusInfo = ({ status }: { status: VerificationStatus }) => {
  const { t } = useTranslation()

  switch (status.method) {
    case VerificationMethod.none || !status.verified:
      return <span>{t("app-is-currently-not-verified")}</span>
    case VerificationMethod.login_provider:
      return (
        <Trans i18nKey="app-is-currently-verified-by-login-provider">
          Your app is currently verified by your login
          <span className="font-medium">
            {{ login_name: `@${status.login_name}` }}
          </span>
          on
          <span className="font-medium">
            {{
              login_provider: verificationProviderToHumanReadable(
                status.login_provider!,
              ),
            }}
          </span>
          .
        </Trans>
      )
    case VerificationMethod.website:
      return (
        <Trans i18nKey="app-is-currently-verified-by-website">
          Your app is currently verified by your website
          <span className="font-medium">{{ website: status.website }}</span>
        </Trans>
      )
    case VerificationMethod.manual:
      return <span>{t("app-is-currently-verified-manually")}</span>
  }
}

const AppVerificationSetup: FunctionComponent<Props> = ({
  app,
  isNewApp,
  onVerified,
  showHeader = true,
}) => {
  const { t } = useTranslation()

  const query = useQuery({
    queryKey: ["verification", app.id],
    queryFn: async () => {
      return getVerificationStatusVerificationAppIdStatusGet(app.id)
    },
    enabled: !!app.id,
  })

  const verificationAvailableMethods =
    useGetAvailableMethodsVerificationAppIdAvailableMethodsGet(
      app.id,
      { new_app: isNewApp },
      {
        axios: {
          withCredentials: true,
        },
        query: {
          retry: false,
          enabled: query.data && !query.data.data.verified,
        },
      },
    )

  const [confirmUnverify, setConfirmUnverify] = useState<boolean>(false)

  const onChildVerified = useCallback(() => {
    onVerified?.()
  }, [onVerified])

  if (query.isPending || verificationAvailableMethods.isPending) {
    return <Spinner size="m" />
  }

  let content: ReactElement
  if (query.error) {
    content = <InlineError shown={true} error={query.error.message} />
  } else if (verificationAvailableMethods.error?.response?.data?.detail) {
    switch (
      verificationAvailableMethods.error.response.data
        .detail as unknown as string
    ) {
      case "app_already_exists":
        content = <InlineError shown={true} error={t("app-already-exists")} />
        break
      case "malformed_app_id":
        content = <InlineError shown={true} error={t("malformed-app-id")} />
        break
      case "app_already_verified":
        if (isNewApp) {
          content = <InlineError shown={true} error={t("app-already-exists")} />
        } else {
          content = (
            <div>
              <StatusInfo status={query.data.data} />

              <br />

              <Button
                size="lg"
                className="mt-3"
                onClick={() => setConfirmUnverify(true)}
              >
                {t("unverify")}
              </Button>

              <ConfirmDialog
                isVisible={confirmUnverify}
                prompt={t("unverify", { appId: app.id })}
                action={t("unverify")}
                actionVariant="destructive"
                onConfirmed={() => {
                  setConfirmUnverify(false)

                  unverifyVerificationAppIdUnverifyPost(app.id, {
                    withCredentials: true,
                  }).then(() => {
                    query.refetch()
                  })
                }}
                onCancelled={() => setConfirmUnverify(false)}
              >
                {t("unverify-app-prompt", { appId: app.id })}
              </ConfirmDialog>
            </div>
          )
        }
        break
      default:
        content = (
          <InlineError
            shown={true}
            error={t("error-code", {
              code: verificationAvailableMethods.error?.response.data.detail,
            })}
          />
        )
    }
  } else {
    content = (
      <div className="space-y-3">
        <p className="xl:max-w-[75%]">{t("verification-instructions")}</p>
        <div className="xl:max-w-[75%]">
          <Alert>
            <AlertDescription>{t("verification-warning")}</AlertDescription>
          </Alert>
        </div>

        {verificationAvailableMethods.isPending ? (
          <Spinner size="m" />
        ) : (
          verificationAvailableMethods.data?.data?.methods?.map(
            (methodType) => {
              if (methodType.method === "website") {
                return (
                  <WebsiteVerification
                    key={methodType.method}
                    appId={app.id}
                    method={methodType}
                    isNewApp={isNewApp}
                    onVerified={onChildVerified}
                  ></WebsiteVerification>
                )
              }
              if (methodType.method === "login_provider") {
                return (
                  <LoginVerification
                    key={methodType.method}
                    appId={app.id}
                    method={methodType}
                    isNewApp={isNewApp}
                    onVerified={onChildVerified}
                    onReloadNeeded={query.refetch}
                  ></LoginVerification>
                )
              }
            },
          )
        )}
      </div>
    )
  }

  return (
    <>
      {showHeader && (
        <h2 className="mb-6 text-2xl font-bold">{t("verification")}</h2>
      )}
      {content}
    </>
  )
}

export default AppVerificationSetup
