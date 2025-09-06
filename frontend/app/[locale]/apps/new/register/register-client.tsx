"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTranslations } from "next-intl"
import { ReactElement, useEffect, useState } from "react"
import { getUserData } from "src/asyncs/login"
import Spinner from "src/components/Spinner"
import { AppVerificationSetup } from "src/components/application/AppVerificationControls"
import LoginGuard from "src/components/login/LoginGuard"
import { useUserContext, useUserDispatch } from "src/context/user-info"
import { Appstream } from "src/types/Appstream"
import type { JSX } from "react"
import { useRouter } from "src/i18n/navigation"

const RegisterClient = (): JSX.Element => {
  const t = useTranslations()
  const [appId, setAppId] = useState<string>("")
  const userInfo = useUserContext()
  const userDispatch = useUserDispatch()

  const [step, setStep] = useState<"start" | "verify" | "wait">("start")

  const router = useRouter()

  useEffect(() => {
    if (userInfo && !userInfo.info?.accepted_publisher_agreement_at) {
      router.replace("/apps/new/publisher-agreement")
    }
  }, [userInfo, router])

  let content: ReactElement

  if (!userInfo.info?.accepted_publisher_agreement_at) {
    content = <Spinner size="m" />
  } else {
    content = (
      <div className="space-y-4">
        <h1 className="mb-8 mt-8 text-4xl font-extrabold">
          {t("new-direct-upload")}
        </h1>
        <Alert>
          <AlertDescription>
            {t.rich("app-id-instructions", { i: (chunks) => <i>{chunks}</i> })}
          </AlertDescription>
        </Alert>

        <Input
          type="text"
          placeholder={t("app-id")}
          onChange={(e) => {
            setAppId(e.target.value)
            setStep("start")
          }}
          onKeyUp={(e) => {
            if (e.key === "Enter") {
              setStep("verify")
            }
          }}
        />

        {step === "start" && (
          <Button size="xl" disabled={!appId} onClick={() => setStep("verify")}>
            {t("verify-app-id")}
          </Button>
        )}

        {step === "verify" && (
          <div className="mt-3">
            <AppVerificationSetup
              app={{ id: appId, name: appId } as Appstream}
              isNewApp={true}
              onVerified={async () => {
                setStep("wait")
                /* Update userdata to reflect new app, otherwise the next page will give an unauthorized error */
                await getUserData(userDispatch)
                router.push(`/apps/manage/${appId}`)
              }}
            />
          </div>
        )}

        {step === "wait" && <Spinner size="m" />}
      </div>
    )
  }

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <LoginGuard>{content}</LoginGuard>
    </div>
  )
}

export default RegisterClient
