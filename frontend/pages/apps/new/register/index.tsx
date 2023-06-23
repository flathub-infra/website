import { GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import { useState } from "react"
import { getUserData } from "src/asyncs/login"
import Button from "src/components/Button"
import { Notice } from "src/components/Notice"
import { SetupControls } from "src/components/application/AppVerificationControls"
import LoginGuard from "src/components/login/LoginGuard"
import { useUserDispatch } from "src/context/user-info"
import { Appstream } from "src/types/Appstream"

export default function AppRegistrationPage() {
  const { t } = useTranslation()
  const [appId, setAppId] = useState<string>("")
  const userDispatch = useUserDispatch()

  const [step, setStep] = useState<"start" | "verify">("start")

  const router = useRouter()

  let content = (
    <>
      <h1 className="mb-8 mt-8 text-4xl font-extrabold">
        {t("register-new-app")}
      </h1>

      <Notice>{t("app-id-instructions")}</Notice>

      <input
        type="text"
        placeholder={t("app-id")}
        className="my-5 w-full rounded-xl border border-flathub-sonic-silver p-3 dark:border-flathub-spanish-gray"
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
        <Button disabled={!appId} onClick={() => setStep("verify")}>
          {t("verify-app-id")}
        </Button>
      )}

      {step === "verify" && (
        <div className="mt-3">
          <SetupControls
            app={{ id: appId, name: appId } as Appstream}
            isNewApp={true}
            onVerified={async () => {
              /* Update userdata to reflect new app, otherwise the next page will give an unauthorized error */
              await getUserData(userDispatch)
              router.push(`/apps/manage/${appId}`)
            }}
          />
        </div>
      )}
    </>
  )

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title={t("register-new-app")} noindex />
      <LoginGuard>{content}</LoginGuard>
    </div>
  )
}

// Need available login providers to show options on page
export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  }
}
