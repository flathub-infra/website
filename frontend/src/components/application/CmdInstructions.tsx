import { useMatomo } from "@jonkoops/matomo-tracker-react"
import { Trans, useTranslation } from "next-i18next"
import { useTheme } from "next-themes"
import CodeCopy from "./CodeCopy"

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
    <div className="rounded-xl bg-bgColorSecondary px-4 pb-4 shadow-md">
      <h3>{t("manual-install")}</h3>
      <p>
        <Trans i18nKey={"common:manual-install-instructions"}>
          Make sure to follow the{" "}
          <a href="https://flatpak.org/setup/" target="_blank" rel="noreferrer">
            setup guide
          </a>{" "}
          before installing
        </Trans>
      </p>
      <CodeCopy
        text={`flatpak install flathub ${appId}`}
        nested={resolvedTheme === "dark"}
        onCopy={flatpakInstallCopied}
      />
      <h3>{t("run")}</h3>
      <CodeCopy
        text={`flatpak run ${appId}`}
        nested={resolvedTheme === "dark"}
        onCopy={flatpakRunCopied}
      />
    </div>
  )
}

export default CmdInstructions
