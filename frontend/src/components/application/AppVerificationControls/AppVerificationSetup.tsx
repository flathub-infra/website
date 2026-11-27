import { FunctionComponent, ReactElement, useState } from "react"
import { verificationProviderToHumanReadable } from "src/verificationProvider"
import { useUserContext } from "src/context/user-info"
import ConfirmDialog from "../../ConfirmDialog"
import Spinner from "../../Spinner"
import LoginVerification from "./LoginVerification"
import WebsiteVerification from "./WebsiteVerification"
import DnsVerification from "./DnsVerification"
import InlineError from "src/components/InlineError"
import { useQuery } from "@tanstack/react-query"
import {
  GetAppstreamAppstreamAppIdGet200,
  GetVerificationStatusVerificationAppIdStatusGet200,
  VerificationMethod,
  Permission,
} from "src/codegen/model"
import {
  getVerificationStatusVerificationAppIdStatusGet,
  getCanUnverifyVerificationAppIdCanUnverifyGetQueryKey,
  useCanUnverifyVerificationAppIdCanUnverifyGet,
  useUnverifyVerificationAppIdUnverifyPost,
  useGetAvailableMethodsVerificationAppIdAvailableMethodsGet,
  useManualVerificationVerificationAppIdManualVerificationPost,
} from "src/codegen"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useTranslations } from "next-intl"

interface Props {
  app: Pick<GetAppstreamAppstreamAppIdGet200, "id">
  isNewApp: boolean
  onVerified?: () => void
  showHeader?: boolean
}

const StatusInfo = ({
  status,
}: {
  status: GetVerificationStatusVerificationAppIdStatusGet200
}) => {
  const t = useTranslations()

  if (!status.verified) {
    return <span>{t("app-is-currently-not-verified")}</span>
  }

  switch (status.method) {
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
    case VerificationMethod.dns:
      return t.rich("app-is-currently-verified-by-dns", {
        domain: (chunk) => (
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

  const user = useUserContext()
  const isDeveloper = user.info?.dev_flatpaks?.includes(app.id)
  const canUseMethods = isNewApp || !!isDeveloper
  const canModifyUsers = user.info?.permissions.includes(
    Permission["modify-users"],
  )

  const query = useQuery({
    queryKey: ["verification", app.id],
    queryFn: async () => {
      return getVerificationStatusVerificationAppIdStatusGet(app.id)
    },
    enabled: !!app.id,
  })

  const methodsEnabled =
    canUseMethods && !query.error && query.data?.data.verified === false
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
          enabled: methodsEnabled,
        },
      },
    )

  const [confirmUnverify, setConfirmUnverify] = useState<boolean>(false)
  const account = user.info?.invite_code
  const checkRevocation = !!account && !!app.id && !isNewApp
  const revocation = useCanUnverifyVerificationAppIdCanUnverifyGet(app.id, {
    axios: { withCredentials: true },
    query: {
      enabled: checkRevocation,
      queryKey: [
        ...getCanUnverifyVerificationAppIdCanUnverifyGetQueryKey(app.id),
        account,
      ],
    },
  })
  const refreshVerification = () =>
    Promise.all([
      query.refetch(),
      checkRevocation && revocation.refetch(),
      !isNewApp && methodsEnabled && verificationAvailableMethods.refetch(),
    ])
  const unverify = useUnverifyVerificationAppIdUnverifyPost({
    axios: { withCredentials: true },
    mutation: { onSettled: refreshVerification },
  })

  const manualVerifyMutation =
    useManualVerificationVerificationAppIdManualVerificationPost({
      axios: {
        withCredentials: true,
      },
    })

  const onChildVerified = () => {
    refreshVerification()
    onVerified?.()
  }

  if (query.isPending) {
    return <Spinner size="m" />
  }

  let content: ReactElement | null = null
  let methodsReportedVerified = false
  const showMethods = canUseMethods && (isNewApp || !query.data?.data.verified)
  if (query.data && showMethods && verificationAvailableMethods.error) {
    const errorData = verificationAvailableMethods.error.response?.data
    // Handle custom error responses with string detail
    let detail: string | undefined
    if (
      errorData &&
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
          methodsReportedVerified = true
          if (isNewApp) {
            content = (
              <InlineError shown={true} error={t("app-already-exists")} />
            )
          } else {
            content = (
              <Button
                variant="outline"
                onClick={async () => {
                  const status = await query.refetch()
                  if (status.isSuccess && !status.data.data.verified) {
                    await verificationAvailableMethods.refetch()
                  }
                }}
              >
                {t("refresh")}
              </Button>
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
  } else if (query.data && !query.error && showMethods) {
    content = (
      <div className="flex flex-col gap-5">
        {isNewApp && (
          <p className="font-semibold">
            <StatusInfo status={query.data.data} />
          </p>
        )}
        <p className="max-w-prose text-sm leading-relaxed text-foreground">
          {t.rich("app-management.verification-description", {
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
              if (methodType.method === "dns") {
                return (
                  <DnsVerification
                    key={methodType.method}
                    appId={app.id}
                    method={methodType}
                    isNewApp={isNewApp}
                    onVerified={onChildVerified}
                  />
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
        <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
          {t("verification-warning")}
        </p>
      </div>
    )
  }

  return (
    <>
      {showHeader && (
        <h2 className="mb-6 text-2xl font-bold">{t("verification")}</h2>
      )}
      {query.error && <InlineError shown={true} error={query.error.message} />}
      {!isNewApp && query.data ? (
        <div className="flex flex-col items-start gap-5">
          <p className="font-semibold">
            {methodsReportedVerified ? (
              t("verified")
            ) : (
              <StatusInfo status={query.data.data} />
            )}
          </p>
          {content}
          {!query.error &&
            checkRevocation &&
            revocation.isSuccess &&
            revocation.data.data && (
              <>
                <Button
                  variant="outline"
                  disabled={unverify.isPending}
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
                    unverify.mutate({ appId: app.id })
                  }}
                  onCancelled={() => setConfirmUnverify(false)}
                >
                  {t("unverify-app-prompt", { appId: app.id })}
                </ConfirmDialog>
              </>
            )}
          {unverify.isError && (
            <InlineError shown error={t("unverify-failed")} />
          )}
        </div>
      ) : (
        content
      )}

      {canModifyUsers && !isNewApp && query.data && (
        <div className="mt-6 flex flex-col items-start gap-4">
          <Separator />
          <h3 className="text-sm font-semibold">Administrator actions</h3>
          <Button
            variant="outline"
            disabled={
              !!query.error ||
              query.data.data.verified ||
              methodsReportedVerified
            }
            onClick={() => {
              manualVerifyMutation.mutate(
                { appId: app.id },
                {
                  onSuccess: onChildVerified,
                },
              )
            }}
          >
            Mark as manually verified
          </Button>
        </div>
      )}
    </>
  )
}

export default AppVerificationSetup
