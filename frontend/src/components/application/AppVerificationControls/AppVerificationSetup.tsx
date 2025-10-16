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
import { useTranslations } from "next-intl"

interface Props {
  app: Pick<Appstream, "id">
  isNewApp: boolean
  onVerified?: () => void
  showHeader?: boolean
}

const StatusInfo = ({ status }: { status: VerificationStatus }) => {
  const t = useTranslations()

  switch (status.method) {
    case VerificationMethod.none || !status.verified:
      return <span>{t("app-is-currently-not-verified")}</span>
    case VerificationMethod.login_provider:
      return t.rich("app-is-currently-verified-by-login-provider", {
        loginname: (chunk) => (
          <span className="font-medium">{`@${status.login_name}`}</span>
        ),
        loginprovider: (chunk) => (
          <span className="font-medium">
            {verificationProviderToHumanReadable(status.login_provider!)}
          </span>
        ),
      })

    case VerificationMethod.website:
      return t.rich("app-is-currently-verified-by-website", {
        website: (chunk) => (
          <span className="font-medium">{status.website}</span>
        ),
      })
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
  const t = useTranslations()

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
  } else if (verificationAvailableMethods.error?.response?.data) {
    const errorData = verificationAvailableMethods.error.response.data
    // Handle custom error responses with string detail
    let detail: string | undefined
    if (
      typeof errorData === "object" &&
      "detail" in errorData &&
      typeof errorData.detail === "string"
    ) {
      detail = errorData.detail
    }

    if (detail) {
      switch (detail) {
        case "app_already_exists":
          content = <InlineError shown={true} error={t("app-already-exists")} />
          break
        case "malformed_app_id":
          content = <InlineError shown={true} error={t("malformed-app-id")} />
          break
        case "app_already_verified":
          if (isNewApp) {
            content = (
              <InlineError shown={true} error={t("app-already-exists")} />
            )
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
                code: detail,
              })}
            />
          )
      }
    } else {
      // Handle other error types
      content = (
        <InlineError
          shown={true}
          error={verificationAvailableMethods.error.message}
        />
      )
    }
  } else {
    content = (
      <div className="space-y-3">
        <p className="xl:max-w-[75%]">
          {t.rich("verification-instructions", {
            doclink: (chunk) => (
              <a
                href="https://docs.flathub.org/docs/for-app-authors/verification"
                target="_blank"
                rel="noreferrer"
                className="no-underline hover:underline"
              >
                {chunk}
              </a>
            ),
          })}
        </p>
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
