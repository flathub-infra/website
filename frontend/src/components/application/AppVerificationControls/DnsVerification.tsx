import { FunctionComponent, ReactElement, useState } from "react"
import { useTranslations } from "next-intl"
import InlineError from "src/components/InlineError"
import Spinner from "src/components/Spinner"
import { FlathubDisclosure } from "../../Disclosure"
import { useMutation } from "@tanstack/react-query"
import {
  AvailableMethod,
  DnsVerificationResult,
  DnsVerificationToken,
} from "src/codegen/model"
import {
  confirmDnsVerificationVerificationAppIdConfirmDnsVerificationPost,
  setupDnsVerificationVerificationAppIdSetupDnsVerificationPost,
} from "src/codegen"
import { Button } from "@/components/ui/button"

interface Props {
  appId: string
  method: AvailableMethod
  isNewApp: boolean
  onVerified: () => void
}

const DnsVerification: FunctionComponent<Props> = ({
  appId,
  method,
  isNewApp,
  onVerified,
}) => {
  const t = useTranslations()

  const [returnedChallenge, setReturnedChallenge] =
    useState<DnsVerificationToken>(null)
  const [confirmResult, setConfirmResult] =
    useState<DnsVerificationResult>(null)

  const setupDnsVerificationMutation = useMutation({
    mutationKey: ["dns-verification", appId, isNewApp ?? false],
    mutationFn: () =>
      setupDnsVerificationVerificationAppIdSetupDnsVerificationPost(
        appId,
        { new_app: isNewApp },
        {
          withCredentials: true,
        },
      ),
    onSuccess: (result) => setReturnedChallenge(result.data),
  })

  const confirmDnsVerificationMutation = useMutation({
    mutationKey: ["confirm-dns-verification", appId, isNewApp ?? false],
    mutationFn: () =>
      confirmDnsVerificationVerificationAppIdConfirmDnsVerificationPost(
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

  const domain = returnedChallenge?.domain ?? method.dns_domain
  const recordName = returnedChallenge?.record_name ?? method.dns_record_name
  const token = returnedChallenge?.token ?? method.dns_token

  let content: ReactElement

  if (token) {
    let resultInfo: ReactElement

    if (confirmResult == null) {
      resultInfo = null
    } else if (confirmResult.detail === "dns_record_not_found") {
      resultInfo = (
        <InlineError
          shown={true}
          error={t("dns-record-not-found", { record: recordName })}
        />
      )
    } else if (confirmResult.detail === "dns_token_not_present") {
      resultInfo = (
        <InlineError
          shown={true}
          error={t("dns-token-not-present", { record: recordName })}
        />
      )
    } else if (confirmResult.detail === "dns_lookup_failed") {
      resultInfo = (
        <InlineError
          shown={true}
          error={t("dns-lookup-failed", { record: recordName })}
        />
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
      <div className="space-y-3">
        <p>{t("dns-validation-instruction")}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 rounded-xl bg-flathub-gainsborow/40 p-4 dark:bg-flathub-dark-gunmetal">
          <dt className="font-semibold">{t("name")}</dt>
          <dd>
            <code>{recordName}</code>
          </dd>
          <dt className="font-semibold">{t("type")}</dt>
          <dd>
            <code>TXT</code>
          </dd>
          <dt className="font-semibold">{t("dns-record-value")}</dt>
          <dd className="break-all">
            <code>{token}</code>
          </dd>
        </dl>

        <Button
          size="lg"
          onClick={() => confirmDnsVerificationMutation.mutate()}
        >
          {t("continue")}
        </Button>

        {confirmDnsVerificationMutation.isPending && (
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
          {t.rich("dns-verification-main-instruction", {
            id: appId,
            domain,
            bold: (chunks) => <span className="font-semibold">{chunks}</span>,
          })}
        </p>
        <Button
          size="lg"
          onClick={() => setupDnsVerificationMutation.mutate()}
          disabled={setupDnsVerificationMutation.isPending}
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
        <h4 className="text-xl font-medium">{t("dns-verification")}</h4>
      }
    >
      {content}
    </FlathubDisclosure>
  )
}

export default DnsVerification
