import { useTranslations } from "next-intl"
import { verificationProviderToHumanReadable } from "./verificationProvider"
import { GetVerificationStatusVerificationAppIdStatusGet200 } from "./codegen"

export const VerificationText = (
  verificationStatus: GetVerificationStatusVerificationAppIdStatusGet200,
) => {
  const t = useTranslations()

  switch (verificationStatus.method) {
    case "manual":
      return t("verified")

    case "website":
      if (verificationStatus.website === "gnome.org") {
        return "GNOME"
      }
      return verificationStatus.website

    case "login_provider":
      if (
        verificationStatus.login_provider === "kde" &&
        verificationStatus.login_name === "teams/flathub" &&
        verificationStatus.login_is_organization === true
      ) {
        return "KDE"
      }
      return t("verified-login-provider", {
        login_provider: verificationProviderToHumanReadable(
          verificationStatus.login_provider,
        ),
        login_name: verificationStatus.login_name,
      })
  }
}
