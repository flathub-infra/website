import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
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
    <Alert className="xl:max-w-[75%]">
      <InfoIcon />
      <AlertDescription>
        <p>
          {t(
            isExtraData
              ? "unverified-app-disclaimer-wrapper"
              : "unverified-app-disclaimer-package",
            { developer },
          )}
        </p>
      </AlertDescription>
    </Alert>
  )
}
