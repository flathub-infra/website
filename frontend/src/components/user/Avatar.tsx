import Image from "next/image"
import { FunctionComponent } from "react"
import FallbackAvatar from "boring-avatars"
import { useTranslation } from "next-i18next"

interface Props {
  avatarUrl: string | null
  userName: string
}

const celestialBlue = "#4a90d9"
const variationTone = "#70dee6"

const Avatar: FunctionComponent<Props> = (props: Props) => {
  const { avatarUrl, userName } = props
  const { t } = useTranslation()

  return avatarUrl ? (
    <Image
      className="rounded-full"
      src={avatarUrl}
      width="38"
      height="38"
      alt={t("user-avatar", {
        user: userName,
      })}
    />
  ) : (
    <FallbackAvatar
      size={38}
      name={userName}
      variant="marble"
      colors={[celestialBlue, variationTone]}
    />
  )
}

export default Avatar
