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
      {iconUrl ? (
        iconUrl.startsWith("https://dl.flathub.org") ||
        iconUrl.startsWith("https://flathub.org") ? (
          <Image
            src={iconUrl}
            alt={t("app-logo", { "app-name": appName })}
            width={128}
            height={128}
            placeholder="blur"
          />
        ) : (
          <img
            src={iconUrl}
            alt={t("app-logo", { "app-name": appName })}
            className="my-8 mx-auto block h-32 w-32 self-center"
          />
        )
      ) : (
        <Image
          src="/img/flathub-logo.png"
          alt={t("app-logo", { "app-name": appName })}
          width={128}
          height={128}
        />
      )}
    </>
  )
}
export default LogoImage
