import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import FlathubImage from "../components/Image"

interface Props {
  iconUrl: string
  appName: string
  size?: "128" | "256"
}

const LogoImage: FunctionComponent<Props> = ({
  iconUrl,
  appName,
  size = "128",
}) => {
  const { t } = useTranslation()

  return (
    <>
      {iconUrl &&
      (iconUrl.startsWith("https://dl.flathub.org") ||
        iconUrl.startsWith("https://flathub.org")) ? (
        <FlathubImage
          src={iconUrl}
          alt={t("app-logo", { "app-name": appName })}
          aria-hidden
          width={size}
          height={size}
          style={{ maxHeight: "auto", maxWidth: "100%" }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center dark:invert p-1">
          <FlathubImage
            src="/img/logo/flathub-logo-mini.svg"
            alt={t("app-logo", { "app-name": appName })}
            width={110}
            height={108}
            aria-hidden
          />
        </div>
      )}
    </>
  )
}
export default LogoImage
