import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import Image from "../components/Image"

interface Props {
  iconUrl: string
  appName: string
}

const LogoImage: FunctionComponent<Props> = ({ iconUrl, appName }) => {
  const { t } = useTranslation()

  return (
    <>
      {iconUrl &&
      (iconUrl.startsWith("https://dl.flathub.org") ||
        iconUrl.startsWith("https://flathub.org")) ? (
        <Image
          src={iconUrl}
          alt={t("app-logo", { "app-name": appName })}
          layout="fill"
          aria-hidden
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center dark:invert">
          <Image
            src="/img/logo/flathub-logo-mini.svg"
            alt={t("app-logo", { "app-name": appName })}
            layout="fixed"
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
