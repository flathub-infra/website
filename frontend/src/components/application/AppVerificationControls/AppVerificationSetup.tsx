import { Trans, useTranslation } from "next-i18next"
import { FunctionComponent, ReactElement, useCallback, useState } from "react"
import { Notice } from "src/components/Notice"
import { Appstream } from "src/types/Appstream"
import { verificationProviderToHumanReadable } from "src/verificationProvider"
import Button from "../../Button"
import ConfirmDialog from "../../ConfirmDialog"
import Spinner from "../../Spinner"
import LoginVerification from "./LoginVerification"
import WebsiteVerification from "./WebsiteVerification"
import InlineError from "src/components/InlineError"
import { useQuery } from "@tanstack/react-query"
import { verificationApi } from "src/api"
import { VerificationStatus } from "src/codegen"
import { VerificationAvailableMethods } from "src/types/VerificationAvailableMethods"
import { AxiosResponse } from "axios"

interface Props {
  app: Appstream
  isNewApp: boolean
  onVerified?: () => void
}

const StatusInfo = ({ status }: { status: VerificationStatus }) => {
  const { t } = useTranslation()

  switch (status.method) {
    case "none" || !status.verified:
      return <span>{t("app-is-currently-not-verified")}</span>
    case "login_provider":
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
      return <span>{t("app-is-currently-verified-manually")}</span>
  }
}

const AppVerificationSetup: FunctionComponent<Props> = ({
  app,
  isNewApp,
  onVerified,
}) => {
  const { t } = useTranslation()

  const query = useQuery({
    queryKey: ["verification", app.id],
    queryFn: async () => {
      return verificationApi.getVerificationStatusVerificationAppIdStatusGet(
        app.id,
      )
    },
    enabled: !!app.id,
  })

  const verificationAvailableMethods = useQuery({
    queryKey: ["verification-available-methods", app.id],
    queryFn: async () => {
      return verificationApi.getAvailableMethodsVerificationAppIdAvailableMethodsGet(
        app.id,
        isNewApp,
        {
          withCredentials: true,
        },
      ) as Promise<AxiosResponse<VerificationAvailableMethods | undefined>>
    },
    retry: false,
    enabled: query.data && !query.data.data.verified,
  })

  const [confirmUnverify, setConfirmUnverify] = useState<boolean>(false)

  const onChildVerified = useCallback(() => {
    query.refetch()
    onVerified?.()
  }, [onVerified, query])

  if (query.isPending || verificationAvailableMethods.isPending) {
    return <Spinner size="m" />
  }

  let content: ReactElement
  if (query.error) {
    content = <InlineError shown={true} error={query.error.message} />
  } else if (verificationAvailableMethods.data?.data.detail) {
    let errorCode: string
    switch (verificationAvailableMethods.data?.data.detail) {
      case "app_already_exists":
        errorCode = t("app-already-exists")
        break
      case "malformed_app_id":
        errorCode = t("malformed-app-id")
        break
      default:
        errorCode = t("error-code", {
          code: verificationAvailableMethods.data.data.detail,
        })
    }
    content = <InlineError shown={true} error={errorCode} />
  } else if (query.data?.data.verified) {
    if (isNewApp) {
      content = <InlineError shown={true} error={t("app-already-exists")} />
    } else {
      content = (
        <div>
          <StatusInfo status={query.data.data} />

          <br />

          <Button className="mt-3" onClick={() => setConfirmUnverify(true)}>
            {t("unverify")}
          </Button>

          <ConfirmDialog
            isVisible={confirmUnverify}
            prompt={t("unverify-app-prompt", { appId: app.id })}
            action={t("unverify")}
            actionVariant="destructive"
            onConfirmed={() => {
              setConfirmUnverify(false)
              verificationApi
                .unverifyVerificationAppIdUnverifyPost(app.id, {
                  withCredentials: true,
                })
                .then(() => {
                  query.refetch()
                })
            }}
            onCancelled={() => setConfirmUnverify(false)}
          />
        </div>
      )
    }
  } else {
    content = (
      <div className="space-y-3">
        <p className="xl:max-w-[75%]">{t("verification-instructions")}</p>
        <div className="xl:max-w-[75%]">
          <Notice>{t("verification-warning")}</Notice>
        </div>

        {verificationAvailableMethods.isPending ? (
          <Spinner size="m" />
        ) : (
          verificationAvailableMethods.data?.data.methods.map((methodType) => {
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
          })
        )}
      </div>
    )
  }

  return (
    <>
      <h2 className="mb-6 text-2xl font-bold">{t("verification")}</h2>
      {content}
    </>
  )
}

export default AppVerificationSetup
