import { useTranslations } from "next-intl"
import { FunctionComponent } from "react"
import Image from "next/image"

import logoMini from "public/img/logo/flathub-logo-mini.svg"
import { Imgproxy } from "./ImgproxyImage"

interface Props {
  iconUrl: string
  appName: string
  size: 24 | 64 | 96 | 128 | 256
  priority?: boolean
  [key: string]: unknown
}

const LogoImage: FunctionComponent<Props> = ({
  iconUrl,
  appName,
  size,
  priority = false,
  ...props
}) => {
  const t = useTranslations()

  return (
    <>
      {iconUrl &&
      (iconUrl.startsWith("https://dl.flathub.org") ||
        iconUrl.startsWith("https://flathub.org")) ? (
        <Imgproxy
          src={iconUrl}
          alt={t("app-logo", { app_name: appName })}
          aria-hidden
          fetchPriority={priority ? "high" : "auto"}
          width={size}
          height={size}
          {...props}
        />
      ) : (
        <div className="dark:invert p-1">
          <Image
            src={logoMini}
            alt={t("app-logo", { app_name: appName })}
            width={size}
            height={size}
            aria-hidden
            style={{ maxHeight: "auto", maxWidth: "100%" }}
            {...props}
          />
        </div>
      )}
    </>
  )
}
export default LogoImage
