import { default as Image } from "next/image"
import { default as FlathubImage } from "../Image"
import React, { FunctionComponent } from "react"
import FallbackAvatar from "boring-avatars"
import { useTranslation } from "next-i18next"

interface Props {
  avatarUrl: string | null
  userName: string
}

const celestialBlue = "oklch(63.85% 0.1314 251.94)"
const variationTone = "oklch(83.88% 0.1014 201.73)"

const Avatar: FunctionComponent<Props> = (props: Props) => {
  const { t } = useTranslation()

  if (!props.userName) {
    return null
  }

  const { avatarUrl, userName } = props

  if (!avatarUrl) {
    return (
      <FallbackAvatar
        size={38}
        name={userName}
        variant="marble"
        colors={[celestialBlue, variationTone]}
      />
    )
  }

  const elementStyle = {
    className: "rounded-full",
    src: avatarUrl,
    width: 38,
    height: 38,
    alt: t("user-avatar", {
      user: userName,
    }),
  }

  // If the avatar is hosted on our own GitLab instance, we can't use the
  // optimized image loader because it will append image sizes to the URL
  // which KDE GitLab doesn't seem to like.
  if (avatarUrl.startsWith("https://invent.kde.org/uploads/")) {
    return React.createElement(FlathubImage, elementStyle)
  }

  return React.createElement(Image, elementStyle)
}

export default Avatar
