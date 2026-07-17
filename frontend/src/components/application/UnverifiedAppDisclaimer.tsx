import { useTranslations } from "next-intl"

interface Props {
  developerName?: string | null
  isVerified: boolean
}

export function UnverifiedAppDisclaimer({ developerName, isVerified }: Props) {
  const t = useTranslations()

  if (isVerified) {
    return null
  }

  const developer =
    developerName?.trim().replace(/\.$/, "") ||
    t("unverified-app-disclaimer-unknown-developer")

  return (
    <p className="mt-4 font-medium italic">
      {t("unverified-app-disclaimer-package", { developer })}
    </p>
  )
}
