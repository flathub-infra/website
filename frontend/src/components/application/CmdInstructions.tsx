import { useMatomo } from "@jonkoops/matomo-tracker-react"
import { Trans, useTranslation } from "next-i18next"
import { useTheme } from "next-themes"
import CodeCopy from "./CodeCopy"
import Link from "next/link"

const CmdInstructions = ({ appId }: { appId: string }) => {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const { trackEvent } = useMatomo()

  const flatpakInstallCopied = () => {
    trackEvent({
      category: "App",
      action: "InstallCmdCopied",
      name: appId ?? "unknown",
    })
  }

  const flatpakRunCopied = () => {
    trackEvent({
      category: "App",
      action: "RunCmdCopied",
      name: appId ?? "unknown",
    })
  }

  return (
    <div className="rounded-xl bg-flathub-white px-4 pb-4 shadow-md dark:bg-flathub-arsenic">
      <h3 className="my-4 text-xl font-semibold">{t("manual-install")}</h3>
      <p>
        <Trans i18nKey={"common:manual-install-instructions"}>
          Make sure to follow the{" "}
          <Link href="/setup/" className="no-underline hover:underline">
            setup guide
          </Link>{" "}
          before installing
        </Trans>
      </p>
      <CodeCopy
        text={`flatpak install flathub ${appId}`}
        nested
        onCopy={flatpakInstallCopied}
      />
      <h3 className="my-4 text-xl font-semibold">{t("run")}</h3>
      <CodeCopy
        text={`flatpak run ${appId}`}
        nested
        onCopy={flatpakRunCopied}
      />
    </div>
  )
}

export default CmdInstructions
