import { default as Image } from "next/image"
import { default as UnoptimizedImage } from "../Image"
import React, { FunctionComponent } from "react"
import FallbackAvatar from "boring-avatars"
import { useTranslation } from "next-i18next"

interface Props {
  avatarUrl: string | null
  userName: string
}

const celestialBlue = "#4a90d9"
const variationTone = "#70dee6"

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
    return React.createElement(UnoptimizedImage, elementStyle)
  }

  return React.createElement(Image, elementStyle)
}

export default Avatar
