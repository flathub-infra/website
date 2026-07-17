import { useTranslations } from "next-intl"

interface Props {
  developerName?: string | null
  isExtraData: boolean
  isVerified: boolean
}

export function UnverifiedAppDisclaimer({
  developerName,
  isExtraData,
  isVerified,
}: Props) {
  const t = useTranslations()

  if (isVerified) {
    return null
  }

  const developer =
    developerName?.trim().replace(/\.$/, "") ||
    t("unverified-app-disclaimer-unknown-developer")

  return (
    <p className="mt-4">
      {t(
        isExtraData
          ? "unverified-app-disclaimer-wrapper"
          : "unverified-app-disclaimer-package",
        { developer },
      )}
    </p>
  )
}
