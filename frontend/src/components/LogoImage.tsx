import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import Image from "next/image"

import logoMini from "public/img/logo/flathub-logo-mini.svg"

interface Props {
  iconUrl: string
  appName: string
  size?: "24" | "64" | "128" | "256"
  priority?: boolean
}

const LogoImage: FunctionComponent<Props> = ({
  iconUrl,
  appName,
  size = "128",
  priority = false,
}) => {
  const { t } = useTranslation()

  return (
    <>
      {iconUrl &&
      (iconUrl.startsWith("https://dl.flathub.org") ||
        iconUrl.startsWith("https://flathub.org")) ? (
        <Image
          src={iconUrl}
          alt={t("app-logo", { "app-name": appName })}
          aria-hidden
          width={size}
          height={size}
          style={{ maxHeight: "auto", maxWidth: "100%" }}
          priority={priority}
        />
      ) : (
        <div className="dark:invert p-1">
          <Image
            src={logoMini}
            alt={t("app-logo", { "app-name": appName })}
            width={size}
            height={size}
            aria-hidden
            style={{ maxHeight: "auto", maxWidth: "100%" }}
            priority={priority}
          />
        </div>
      )}
    </>
  )
}
export default LogoImage
