import { useTranslation } from "next-i18next"
import { VerificationStatus } from "./types/VerificationStatus"
import { verificationProviderToHumanReadable } from "./verificationProvider"

export const VerificationText = (verificationStatus: VerificationStatus) => {
  const { t } = useTranslation()

  switch (verificationStatus.method) {
    case "manual":
      return t("verified")

    case "website":
      return verificationStatus.website

    case "login_provider":
      if (
        verificationStatus.login_provider === "gnome" &&
        verificationStatus.login_name === "GNOME" &&
        verificationStatus.login_is_organization === true
      ) {
        return "GNOME"
      }
      return t("verified-login-provider", {
        login_provider: verificationProviderToHumanReadable(
          verificationStatus.login_provider,
        ),
        login_name: verificationStatus.login_name,
      })
  }
}
